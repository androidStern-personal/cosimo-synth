BELOW IS THE PREVIOUS GOAL:
Read new-style-guide.md fully. Treat it as the visual source of truth.
Reskin the existing app to match it. Do not change routing, data, behavior, business logic, or core UX. Refactor styling/components as needed. Do not do a landing-page-only pass.
Definition of done:

1. Design system

- Central tokens exist for guide colors, accents, typography, spacing/radius/shadow/glow as needed.
- Components use tokens/classes/vars, not scattered one-off values.
- Required fonts from the guide are loaded and applied correctly.

2. Coverage

- All primary routes, layouts, nav, forms, buttons, inputs, cards/panels, modals/popovers, tables/lists, statuses, loading/error/empty states are restyled where present.
- No visible default browser/framework UI remains in primary flows.

3. Guide compliance

- Every major section has one accent, exposed in code via var/prop/class/data attr.
- Every major section has the required Liquid Glass detail, traceable in code via reusable class/component/data attr.
- Small controls stay mostly flat. Large structures/recesses carry depth.
- No generic dark theme, random RGB, broad glassmorphism, glossy controls, domed knobs, convex buttons, or decorative sci-fi noise.

4. Audit
   Search the codebase for:
   linear-gradient, radial-gradient, box-shadow, drop-shadow, text-shadow, background-image.
   Each instance must be justified as chassis/panel/recess/Liquid Glass/emissive glow/contact shadow. Remove/fix anything violating new-style-guide.md.
5. Functionality

- Existing flows still work.
- Existing tests pass unless only outdated visual selectors changed.
- Accessibility remains intact, including names for icon-only controls.

6. Verification

- Run available install/build/lint/test commands.
- Start the app if possible.
- Capture screenshots of main routes/states, or create a style showcase if screenshots are unavailable.
- Visually inspect against new-style-guide.md before claiming completion.
  Final response must include:
- files changed
- commands run + results
- tokens/fonts implemented
- major sections with accent + Liquid Glass detail
- gradient/shadow audit summary
- screenshot/showcase paths
- remaining gaps, if any
  Do not say done unless every item above is satisfied. If something cannot be verified, say exactly what is unverified and why.

no subagents. you do everything.

THERE ARE MANY VIOLATIONS. each synth section or card must adhere to the monochrome principle .the entire top row of the synth cards currently does not fill its container and the cards are literally smaller thant the others. im refering to the wavetable card and filter one. the wavetable ui vilates the monochrome principle. for that one the deicision to add a weird liquid glass blob in the upper right was completely wrong. ad a liquid glass lip wher eyou can place controls at the top of the graphic area. the color scheme there not acceptable.

the filter section also violates monochrome accents. all sections do. this was not a true reskin.

refere to .chorus_vst_prototype.html for an example of the ui rules applied correctly. your controls should be of the same quality level

----EVERYTHING AFTER HERE IS NEW GOAL AND FOLLOWUP FEEDBACK ON PREVIOUS ----
the user is asking for the app to be built and launched, so we should do that first and foremost.

1. They're claiming that the version they're seeing seems to be a little bit outdated, as the wavetable and the filter cards are not taking up the top row. They're frustrated that there seems to be so much special case in the way this layout is generated and it hasn't been dried out. It's too easy for a major layout structure to be wrong. We should operate from first principles and redesign the layout so that it will be simple and easy to do the right thing and harder to do the wrong thing. That way we don't have this issue where the cards are the wrong size.
2. The user is complaining that the design style guide specified that you needed to add frosted glass or Liquid Glass at least once per component, and the places it was added are very lazy. What I would recommend is returning back to the chorus VST prototype.html file that they showed you and using that as inspiration for better uses of Liquid Glass per interface element.
3. The user is complaining that the various badges and text are not consistently aligned for each of the major cards. For example the wavetable card has a glass panel at the top showing some of the interface controls, whereas the filter does not. The filter has a filter mode and a cutoff control on the top left and right respectively, but they don't sit in the same position. On the drive component it's different again. There's just not enough standardization across the layouts of all these different effect cards. We need to find a way to put certain types of information in predictable locations and have style reuse across them so it stops being so divergent. This is just for the readouts on these things. The main graphic should more or less remain how it is.

Next is a separate assignment. The user wants to add an exception to the monochromatic perception rule: any control or parameter that is different from its baseline value in the default preset for a patch should be highlighted in a different color.

We need a few different concepts here. I'm not sure if we even have the concept of a default articulation in a preset, but we need to add that so all presets have at least one default articulation. This is the fallback: it's what they start with, it's specified at the preset level, and they all must always have one.

For all other articulations, if we compare their values with the default and take only the ones that have diverged, that is the set of parameters that should be highlighted in the UI.

For highlighting, do not draw a box around everything. That is very stupid. We want to be strategic about this. For example if there's a readout element like a filter cutoff value displayed on the page, we'll just color it differently, make it more glowing, and make it a special color. The color is going to map onto the color that was selected for the articulation. Each articulation card has a color, and we will color all of the parameters that are different for that articulation from default in that color.
