use hdk::prelude::*;

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

#[hdk_extern]
fn init(_: ()) -> ExternResult<InitCallbackResult> {
    // grant unrestricted access to accept_cap_claim so other agents can send us claims
    let mut foo_functions = BTreeSet::new();
    foo_functions.insert((zome_info()?.name, "foo".into()));
    create_cap_grant(CapGrantEntry {
        tag: "".into(),
        // empty access converts to unrestricted
        access: ().into(),
        functions: GrantedFunctions::Listed(foo_functions),
    })?;
    // NB: ideally we want to simply create a single CapGrant with both functions exposed,
    // but there is a bug in Holochain which currently prevents this. After this bug is fixed,
    // this can be collapsed to a single CapGrantEntry with two functions.
    // see: https://github.com/holochain/holochain/issues/418
    let mut emitter_functions = BTreeSet::new();
    emitter_functions.insert((zome_info()?.name, "emitter".into()));
    create_cap_grant(CapGrantEntry {
        tag: "".into(),
        // empty access converts to unrestricted
        access: ().into(),
        functions: GrantedFunctions::Listed(emitter_functions),
    })?;

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
    let mut x: u64 = 3;
    for _ in 0..999999 {
        x = x.wrapping_pow(x as u32);
    }
    Ok(TestString(x.to_string()))
}
