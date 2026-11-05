// All the wording on the page lives here, so you can change it without touching the layout.
export const site = {
  brand: "Lazy Films City",
  pageTitle: "Free House Waitlist | Lazy Films City",
  headline: "Get a free house in my city.",
  description:
    "Sign in with Google and add your Instagram, and your house starts going up on the next empty plot. Every town has 1,000 plots. When one fills up, the next town opens, so there's a plot for everyone.",
  steps: ["Sign in with Google", "Add your Instagram", "Your house goes up"],
  privacyNote: "Your Instagram username is shown on your house. Your Google name and email stay private.",
  oneEntryNote: "One house per Google account and per Instagram account.",
  customizeTitle: "Customize your house",
  customizeNote: "Customization will be available soon.",
  // Town 1 is the first town; rename towns here.
  townName: (n: number) => `Town ${n}`,
} as const;
