use hdk::prelude::*;

#[hdk_extern]
pub fn echo_app_entry_type(entry_type: AppEntryType) -> ExternResult<()> {
    debug!("echo_app_entry_type() called: {:?}", entry_type);
    Ok(())
}
