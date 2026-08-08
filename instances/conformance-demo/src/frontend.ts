/**
 * Presentation owned by the reference instance. The platform app validates
 * this data against the locales and routes in `conformanceDemoProfile`.
 */
export const conformanceDemoFrontend = {
  theme: {
    accent: "#19675b",
    accentStrong: "#0d4038",
    canvas: "#f3f0e8",
    ink: "#17211f",
    muted: "#5a6864",
    panel: "#fffdf7",
    mark: "OL",
  },
  messages: {
    "en-NZ": {
      allIssues: "All public questions",
      apiUnavailable:
        "The public API could not be reached. Check the configured API origin and try again.",
      backToIssues: "Back to public questions",
      contact: "Contact",
      decisions: "Decisions",
      eligibilityDirectory: "Current eligible participants",
      eligibilityDirectoryBody:
        "This complete current set publishes each participant's signed registration and eligibility record. Removed accounts no longer appear in the set.",
      eligibleSince: "Eligible since",
      events: "Timeline",
      featuredIssues: "Current questions",
      featuredProofs: "Example public proofs",
      heroAction: "Browse questions",
      heroEyebrow: "Qualified public opinion, inspectable by anyone",
      issueNotFound: "That public question is not available.",
      jurisdiction: "Jurisdiction",
      loading: "Loading public records…",
      methodology: "Methodology",
      methodologyBody:
        "This reference instance counts one response from each synthetically qualified participant. Its current V3 policy is bound in the instance profile, and public records are read through the same unversioned API paths used by independent frontends.",
      methodologyTitle: "How this index is assembled",
      noIssues: "No public questions matched this view.",
      noEligibleParticipants: "No participant is currently eligible.",
      openParticipant: "Open verification record",
      openIssue: "Open question",
      proofBody:
        "These links open signed proof material returned by the configured public API. A dedicated verifier should validate the nested protocol objects.",
      proofUnavailable: "No example proof is configured for this instance.",
      proceedings: "Proceedings",
      questions: "Questions",
      readOnlyNotice:
        "This frontend reads public data without cookies. Registration and responses remain with the configured relying application.",
      respond: "Respond through the relying application",
      registryEmail: "Registry email",
      responses: "Counted responses",
      sources: "Sources",
      technicalRecord: "Technical record",
      verification: "Verify",
      verificationTitle: "Inspect public proof material",
      viewRawProof: "Open raw proof",
      backToDirectory: "Back to eligible participants",
    },
    "mi-NZ": {
      allIssues: "Ngā pātai tūmatanui katoa",
      apiUnavailable:
        "Kāore i taea te toro atu ki te API tūmatanui. Tirohia te wāhitau API, ka ngana anō.",
      backToIssues: "Hoki ki ngā pātai tūmatanui",
      contact: "Whakapā mai",
      decisions: "Ngā whakataunga",
      eligibilityDirectory: "Ngā kaiuru whai mana o nāianei",
      eligibilityDirectoryBody:
        "Kei tēnei huinga katoa o nāianei ngā pūkete rēhita me te mana kua waitohua. Ka tangohia ngā pūkete kua mukua i te huinga.",
      eligibleSince: "Kua whai mana mai i",
      events: "Rārangi wā",
      featuredIssues: "Ngā pātai o nāianei",
      featuredProofs: "Ngā taunakitanga tūmatanui tauira",
      heroAction: "Tirohia ngā pātai",
      heroEyebrow: "He whakaaro whai tohu, ka taea e te katoa te tirotiro",
      issueNotFound: "Kāore taua pātai tūmatanui i te wātea.",
      jurisdiction: "Rohe ture",
      loading: "E uta ana i ngā kōrero tūmatanui…",
      methodology: "Tikanga",
      methodologyBody:
        "Ka tatau tēnei tauira i te urupare kotahi a ia kaiuru whai tohu horihori. Kei te kōtaha tauira tōna kaupapa here kua whai putanga, ā, ka pānuihia ngā kōrero tūmatanui mā te API kotahi e whakamahia ana e ngā pae motuhake.",
      methodologyTitle: "Te whakaritenga o tēnei taupū",
      noIssues: "Kāore he pātai tūmatanui i kitea.",
      noEligibleParticipants: "Kāore he kaiuru whai mana i tēnei wā.",
      openParticipant: "Whakatuwhera te pūkete manatoko",
      openIssue: "Tuwhera te pātai",
      proofBody:
        "Ka whakatuwhera ēnei hononga i ngā taunakitanga kua waitohua e whakahokia ana e te API tūmatanui. Mā tētahi pūmanatoko motuhake ngā raraunga kawa e whakamana.",
      proofUnavailable: "Kāore he taunakitanga tauira mō tēnei pae.",
      proceedings: "Ngā tukanga",
      questions: "Ngā pātai",
      readOnlyNotice:
        "Ka pānui tēnei pae i ngā raraunga tūmatanui, kāore he pihikete. Kei te taupānga whirinaki te rēhitatanga me ngā urupare.",
      respond: "Tuku urupare mā te taupānga whirinaki",
      registryEmail: "Īmēra rēhita",
      responses: "Ngā urupare kua tatauria",
      sources: "Ngā puna",
      technicalRecord: "Pūkete hangarau",
      verification: "Manatoko",
      verificationTitle: "Tirohia ngā taunakitanga tūmatanui",
      viewRawProof: "Whakatuwhera taunakitanga",
      backToDirectory: "Hoki ki ngā kaiuru whai mana",
    },
  },
  featuredProofs: [
    {
      kind: "verification",
      id: "synthetic-eligibility-v3",
      labels: {
        "en-NZ": "Synthetic qualification attestation",
        "mi-NZ": "Taunakitanga tohu horihori",
      },
    },
    {
      kind: "vote",
      id: "synthetic-vote-v3",
      labels: {
        "en-NZ": "Synthetic signed response",
        "mi-NZ": "Urupare waitohu horihori",
      },
    },
  ],
} as const;
