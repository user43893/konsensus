# Security policy

Report suspected vulnerabilities through the repository's private security
advisory channel before opening a public issue. Include the affected generic
component or contract, synthetic reproduction steps, likely impact, and exact
source commit.

Do not send live credentials, production data, private qualification evidence,
tokens, keys, or provider state by ordinary email.

Security-sensitive reports include cross-instance policy confusion, public API
privacy failures, authorization bypass, signed-format ambiguity, unsafe default
configuration, and a generic component that silently reads or trusts
instance-specific state.

Each relying application defines its own production trust and governance
boundary. Passing the conformance tests does not certify a deployment's policy
or operations.
