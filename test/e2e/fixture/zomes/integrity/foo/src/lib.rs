use hdi::prelude::*;

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
pub enum EntryTypes {
    Test(TestString),
}

#[hdk_link_types]
pub enum LinkTypes {
    A,
}
