use hdk3::prelude::*;

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
    let mut foo_functions: GrantedFunctions = HashSet::new();
    foo_functions.insert((zome_info()?.zome_name, "foo".into()));
    create_cap_grant(
        CapGrantEntry {
            tag: "".into(),
            // empty access converts to unrestricted
            access: ().into(),
            functions: foo_functions,
        }
    )?;
    // NB: ideally we want to simply create a single CapGrant with both functions exposed,
    // but there is a bug in Holochain which currently prevents this. After this bug is fixed,
    // this can be collapsed to a single CapGrantEntry with two functions.
    // see: https://github.com/holochain/holochain/issues/418
    let mut emitter_functions: GrantedFunctions = HashSet::new();
    emitter_functions.insert((zome_info()?.zome_name, "emitter".into()));
    create_cap_grant(
        CapGrantEntry {
            tag: "".into(),
            // empty access converts to unrestricted
            access: ().into(),
            functions: emitter_functions,
        }
    )?;

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
      Err(e) => Err(e)
    }
}
