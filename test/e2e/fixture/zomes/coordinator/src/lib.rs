use hdk::prelude::*;

#[hdk_extern]
pub fn echo_app_entry_def(entry_def: AppEntryDef) -> ExternResult<()> {
    debug!("echo_app_entry_def() called: {:?}", entry_def);
    Ok(())
}

#[hdk_extern]
pub fn delay(ms: u16) -> ExternResult<()> {
    sleep(std::time::Duration::from_millis(ms as u64))?;
    Ok(())
}
