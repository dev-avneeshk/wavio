// All the wording on the page lives here, so you can change it without touching the layout.
export const site = {
  brand: "Lazy Films City",
  pageTitle: "Free House Waitlist | Lazy Films City",
  headline: "Get a free house in my city.",
  description:
    "Sign in with Google, add your Instagram, and pick any empty plot. You get a house and the person who lives in it, and nobody else in town looks like them. Walk them around while you're here; when you're away they live their own life. Your house goes up over 30 days, faster for every friend you invite. Every town has 1,000 plots.",
  steps: ["Sign in with Google", "Add your Instagram", "Your house goes up"],
  privacyNote:
    "Your Instagram username is on your house's board, and tapping your house opens your Instagram. Messages are only seen by you and that neighbour. Your Google name and email stay private.",
  oneEntryNote: "One house per Google account and per Instagram account.",
  customizeTitle: "Customize your house",
  customizeNote: "Customization will be available soon.",
  // Town 1 is the first town; rename towns here.
  townName: (n: number) => `Town ${n}`,
} as const;
