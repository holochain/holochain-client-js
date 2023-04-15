use hdk::prelude::*;

#[hdk_extern]
pub fn echo_app_entry_def(entry_def: AppEntryDef) -> ExternResult<()> {
    debug!("coordinator 2 echo_app_entry_def() called: {:?}", entry_def);
    Ok(())
}

#[hdk_extern]
pub fn echo_hi(_: ()) -> ExternResult<String> {
    Ok(String::from("hi"))
}
