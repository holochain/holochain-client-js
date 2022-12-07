use hdk::prelude::*;

#[hdk_extern]
pub fn echo_app_entry_def(entry_def: AppEntryDef) -> ExternResult<()> {
    debug!("echo_app_entry_def() called: {:?}", entry_def);
    Ok(())
}
