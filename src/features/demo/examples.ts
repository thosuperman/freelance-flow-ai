/** Fictional example conversations for the "insert example" buttons and the guided demo. */
export const EXAMPLE_CONVERSATIONS = [
  {
    key: "landing",
    label: "Landing page (demo story)",
    text: "I need a landing page for my business. Budget is $1,500. I need a first draft in seven days and final delivery in fourteen days. I'll pay 30% upfront and the rest when everything is finished.",
  },
  {
    key: "website",
    label: "Messy WhatsApp thread",
    text: `Maya (Bloom Yoga Studio): hey! loved your portfolio 🙌
Maya: we want a new website, nothing crazy. home, classes, about, contact. maybe 4-5 pages?
Me: Sounds great. Do you have a budget in mind?
Maya: around 2.4k USD? we can do half now and half when it's live
Maya: ideally live in 3 weeks because we're launching summer classes
Maya: oh and it needs to look good on phones, most people find us on instagram
Maya: my email is maya@bloomyoga.example`,
  },
  {
    key: "email",
    label: "Formal email brief",
    text: `Subject: Brand refresh — request for proposal

Dear Sam,

Following our call, Northwind Coffee Roasters would like to commission a logo refresh and a small brand guide (colours, typography, usage rules). Our budget is €3,000.

We would like to see initial logo concepts within two weeks and receive the final files and brand guide within five weeks. We propose 40% on signing, 30% on approval of the chosen concept and 30% on final delivery.

Kind regards,
Daniel Okafor
Head of Marketing, Northwind Coffee Roasters
daniel.okafor@northwind.example`,
  },
] as const;

export const EXAMPLE_SCOPE_CHANGE = "Love the draft! Can you also add a booking system so customers can book a consultation directly from the page?";
