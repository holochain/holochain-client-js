use hdk::prelude::{holo_hash::DnaHash, *};

#[hdk_entry_helper]
pub struct TestString(pub String);

#[derive(Debug, Serialize, Deserialize)]
pub enum SerializationEnum {
    Input,
    Output(String),
}

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

#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
enum EntryTypes {
    Test(TestString),
}

#[hdk_link_types]
enum LinkTypes {
    A,
}

#[hdk_extern]
fn init() -> ExternResult<InitCallbackResult> {
    Ok(InitCallbackResult::Pass)
}

#[hdk_extern]
fn foo() -> ExternResult<TestString> {
    Ok(TestString::from(String::from("foo")))
}

#[hdk_extern]
fn bar() -> ExternResult<TestString> {
    Ok(TestString::from(String::from("bar")))
}

#[hdk_extern]
fn create_an_entry() -> ExternResult<ActionHash> {
    create_entry(EntryTypes::Test(TestString::from(String::from("bar"))))
}

#[hdk_extern]
fn emitter() -> ExternResult<TestString> {
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
pub fn waste_some_time() -> ExternResult<TestString> {
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
    AgentPubKey::try_from_raw_39(bytes)
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(format!("{}", e))))
}

#[hdk_extern]
pub fn decode_as_entryhash(bytes: Vec<u8>) -> ExternResult<EntryHash> {
    EntryHash::try_from_raw_39(bytes)
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(format!("{}", e))))
}

#[hdk_extern]
pub fn decode_as_actionhash(bytes: Vec<u8>) -> ExternResult<ActionHash> {
    ActionHash::try_from_raw_39(bytes)
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(format!("{}", e))))
}

#[hdk_extern]
pub fn decode_as_dnahash(bytes: Vec<u8>) -> ExternResult<DnaHash> {
    DnaHash::try_from_raw_39(bytes)
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(format!("{}", e))))
}

#[hdk_extern]
pub fn create_and_get_link(tag: Vec<u8>) -> ExternResult<Link> {
    let link_base = agent_info()?.agent_initial_pubkey;
    let link_target = link_base.clone();
    let create_link_action_hash = create_link(
        link_base.clone(),
        link_target,
        LinkTypes::A,
        LinkTag::from(tag),
    )?;
    let get_links_input = GetLinksInputBuilder::try_new(link_base, LinkTypes::A)?
        .get_options(GetStrategy::Local)
        .build();
    let links = get_links(get_links_input)?;
    links
        .into_iter()
        .find(|link| link.create_link_hash == create_link_action_hash)
        .ok_or_else(|| wasm_error!("link not found"))
}

#[hdk_extern]
pub fn create_and_delete_link() -> ExternResult<ActionHash> {
    let link_base = agent_info()?.agent_initial_pubkey;
    let link_target = link_base.clone();
    let create_link_action_hash = create_link(link_base.clone(), link_target, LinkTypes::A, ())?;
    delete_link(create_link_action_hash.clone(), GetOptions::local())
}

#[hdk_extern]
pub fn get_agent_activity(chain_top: ActionHash) -> ExternResult<Vec<RegisterAgentActivity>> {
    let agent = agent_info()?.agent_initial_pubkey;
    must_get_agent_activity(agent, ChainFilter::new(chain_top))
}

#[hdk_extern]
pub fn enum_serialization(input: SerializationEnum) -> ExternResult<SerializationEnum> {
    tracing::info!("incoming enum serialization value: {input:?}");
    assert!(matches!(input, SerializationEnum::Input));
    Ok(SerializationEnum::Output("success".to_string()))
}
