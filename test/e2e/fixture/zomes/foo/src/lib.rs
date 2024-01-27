use hdk::prelude::{holo_hash::DnaHash, *};

#[derive(Clone, Debug, Serialize, Deserialize, SerializedBytes)]
#[repr(transparent)]
#[serde(transparent)]
pub struct TestString(pub String);

impl From<String> for TestString {
    fn from(s: String) -> Self {
        Self(s)
    }
}

impl From<&str> for TestString {
    fn from(s: &str) -> Self {
        Self(s.to_owned())
    }
}

#[hdk_link_types]
// #[derive]
enum LinkTypes {
    A,
}

#[hdk_extern]
fn init(_: ()) -> ExternResult<InitCallbackResult> {
    Ok(InitCallbackResult::Pass)
}

#[hdk_extern]
fn foo(_: ()) -> ExternResult<TestString> {
    Ok(TestString::from(String::from("foo")))
}

#[hdk_extern]
fn bar(_: ()) -> ExternResult<TestString> {
    Ok(TestString::from(String::from("bar")))
}

#[hdk_extern]
fn emitter(_: ()) -> ExternResult<TestString> {
    match emit_signal(&TestString::from(String::from("i am a signal"))) {
        Ok(()) => Ok(TestString::from(String::from("bar"))),
        Err(e) => Err(e),
    }
}

#[hdk_extern]
pub fn echo_app_entry_def(entry_def: AppEntryDef) -> ExternResult<()> {
    debug!("echo_app_entry_def() called: {:?}", entry_def);
    Ok(())
}

#[hdk_extern]
pub fn waste_some_time(_: ()) -> ExternResult<TestString> {
    let mut x: u32 = 3;
    for _ in 0..2 {
        for _ in 0..99999999 {
            x = x.wrapping_pow(x);
        }
    }
    Ok(TestString(x.to_string()))
}

#[hdk_extern]
pub fn decode_as_agentpubkey(bytes: Vec<u8>) -> ExternResult<AgentPubKey> {
    AgentPubKey::from_raw_39(bytes)
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(format!("{}", e))))
}

#[hdk_extern]
pub fn decode_as_entryhash(bytes: Vec<u8>) -> ExternResult<EntryHash> {
    EntryHash::from_raw_39(bytes).map_err(|e| wasm_error!(WasmErrorInner::Guest(format!("{}", e))))
}

#[hdk_extern]
pub fn decode_as_actionhash(bytes: Vec<u8>) -> ExternResult<ActionHash> {
    ActionHash::from_raw_39(bytes).map_err(|e| wasm_error!(WasmErrorInner::Guest(format!("{}", e))))
}

#[hdk_extern]
pub fn decode_as_dnahash(bytes: Vec<u8>) -> ExternResult<DnaHash> {
    DnaHash::from_raw_39(bytes).map_err(|e| wasm_error!(WasmErrorInner::Guest(format!("{}", e))))
}

#[hdk_extern]
pub fn create_and_get_link(tag: Vec<u8>) -> ExternResult<Link> {
    let link_base = agent_info()?.agent_latest_pubkey;
    let link_target = link_base.clone();
    let create_link_action_hash = create_link(
        link_base.clone(),
        link_target,
        LinkTypes::A,
        LinkTag::from(tag),
    )?;
    let get_links_input = GetLinksInputBuilder::try_new(link_base, LinkTypes::A)?.build();
    let links = get_links(get_links_input)?;
    links
        .into_iter()
        .find(|link| link.create_link_hash == create_link_action_hash)
        .ok_or_else(|| wasm_error!("link not found"))
}

#[hdk_extern]
pub fn create_and_delete_link(_: ()) -> ExternResult<ActionHash> {
    let link_base = agent_info()?.agent_latest_pubkey;
    let link_target = link_base.clone();
    let create_link_action_hash = create_link(link_base.clone(), link_target, LinkTypes::A, ())?;
    delete_link(create_link_action_hash.clone())
}

#[hdk_extern]
pub fn get_agent_activity(chain_top: ActionHash) -> ExternResult<Vec<RegisterAgentActivity>> {
    let agent = agent_info()?.agent_initial_pubkey;
    must_get_agent_activity(agent, ChainFilter::new(chain_top))
}
