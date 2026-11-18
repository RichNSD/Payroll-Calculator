# Payroll-Calculator
A simple, dynamic calculator for your payroll and monthly expenses.

> [!WARNING]
> ### Currently Being Overhauled
> Originally this was vibe-coded with two quick prompts to ChatGPT. It did what I needed at the time, so I didn't do anything after that. I did't even look at the code it wrote. Boy was that a mistake. 🫩

## My Mistake
Unfortunately my skills in JavaScript and tax law are not quite up to the tast to handle this by myself, so I will be once again using AI. But this time it will be Claude, and it will be _helping_ me.

### Changes so far
The biggest issue I had was that there was no organization to this repo whatsoever. Not a signle direcory. All of that tax data and all the calculations for it were stacked into a single massive `script.js` (which I am currently afraid to touch).

I've reorganizd the existing assets into a generic website directory stystem, and added a `/src/data/[years]` directory structure where the tax data files (probably using JSON) will be added and updated as needed.

### Current Goals & To-do
- [ ] Rework the current structure of the app and untangle the disaster that is the original `script.js`
- [ ] Have Claude collect all the appropriate updated tax information for all 50 states for 2026 and configure it all in the `/src/data` folder
- [ ] Clean up, optimize, and improve the HTML and CSS while maintaining the overall theme

### Changelog
As the upcoming heavy-lifting starts happening, an actual `changelog.md` will be added, most of this content will be moved there, and a real README will be written in all its instructional glory. 😎