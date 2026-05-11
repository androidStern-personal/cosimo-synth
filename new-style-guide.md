Dark Soft-Touch Neon Instrument Interface

Style Guide v0.3

1. Design Intent

This style is a premium, dark, synthetic hardware language for sci-fi musical instruments, audio tools, control panels, and technical devices.

It combines:

* matte rubberized industrial surfaces
* mostly flat interface graphics
* modular synth-style organization
* section-based neon accents
* sparse but required Liquid Glass details
* icon-forward controls
* etched signal-flow groupings
* clean, pristine, idealized CGI precision

The interface should feel tactile and physical, but not bumpy. It should not look like every knob, button, meter, and label has been separately modeled with gradients.

The correct balance is:

large forms have subtle physical depth; small interface details remain mostly flat.

⸻

2. Core Style Principles

2.1 Macro-depth, micro-flatness

Depth belongs primarily to the large structural parts of the object.

Small interface details should be flatter, cleaner, and more graphic.

2.2 Matte first

The base material is always a dark soft-touch rubberized surface. This is the dominant visual identity.

2.3 Neon as signal

Neon color represents active state, data, value, routing, signal, or section identity. It should not become random decoration.

2.4 One accent per section

Each major section gets one accent color. Within that section, active elements stay monochromatic.

2.5 Liquid Glass is required but controlled

Every major section must include at least one small Liquid Glass detail. It should be functional-looking, not decorative clutter.

2.6 Icons before text

Use established symbols where possible. Text is reserved for section names, ambiguous controls, values, and technical readouts.

⸻

3. Base Material System

The object is built from a restrained dark material palette.

Role	Color
Main faceplate / body	#1C1C1C
Primary controls / inactive markings	#373737
Slightly separated dark surfaces	#242424 to #2B2B2B
Deep recesses / display wells	#101010 to #161616
Fine edge definition	#454545 to #555555

The base material should read as:

* matte rubber
* soft-touch plastic
* synthetic instrument surface
* pristine dark hardware

It should not read as:

* glossy plastic
* lacquered wood
* polished metal
* brushed aluminum
* carbon fiber
* leather
* full glassmorphism UI

The surface should feel premium, quiet, and controlled.

⸻

4. Depth System

The original direction allowed too much generalized beveling. This revision preserves the tactile quality but defines where depth belongs.

4.1 Large-Scale Depth

Large structural elements may use subtle depth.

This includes:

* outer chassis
* main body silhouette
* major section panels
* large recessed display wells
* main module blocks
* large physical lips or rims
* large inset areas
* broad body edges

These elements may use:

* shallow bevels
* soft ambient occlusion
* faint inner shadows
* subtle rim highlights
* broad, low-contrast surface falloff
* soft cast shadows

This is where the design gets its physical presence.

4.2 Small-Scale Flatness

Small interface elements should mostly remain flat.

This includes:

* knobs
* buttons
* icons
* labels
* etched lines
* LED segments
* meters
* small pills
* small toggles
* value indicators
* decorative marks

These elements should rely on:

* flat fills
* clean silhouettes
* thin outlines
* spacing
* tiny contact shadows
* emissive glow
* section accent color
* iconography

They should not rely on:

* heavy gradients
* radial shading
* convex highlights
* pillow embossing
* domed surfaces
* repeated bevels on every small element

The interface is not flat UI, but the small parts are much flatter than the body.

⸻

5. Surface Rendering

The faceplate should feel like a calm, continuous matte plane.

Correct surface behavior:

* The main #1C1C1C surface is mostly uniform.
* Large panels can be slightly raised or recessed.
* Recessed displays can have inner shadow.
* Important controls can cast small contact shadows.
* Neon elements can glow.
* Liquid Glass details can have small highlights and refraction.

Incorrect surface behavior:

* Every button has a visible top-left highlight.
* Every knob has a radial gradient.
* Every control looks convex.
* The whole surface looks padded, bubbly, or inflated.
* Small elements look individually sculpted.
* The design becomes a collection of little 3D objects.

The object may be dimensional. The interface details should not become lumpy.

⸻

6. Color System

6.1 Base Palette

The background is always the rubberized dark color.

Role	Color
Main body / faceplate	#1C1C1C
Controls / inactive text / etched details	#373737
Raised dark surfaces	#242424 to #2B2B2B
Recessed display interiors	#101010 to #161616
Fine edge detail	#454545 to #555555

6.2 Accent Palette

Each section gets one accent hue.

Accent Name	Color	Suggested Use
Signal Cyan	#7DF7FF	displays, data, primary signal
Ion Blue	#6FA8FF	routing, sync, utility
Violet	#A98CFF	modulation, space, abstract control
Plasma Pink	#FF79D8	effects, performance, expressive controls
Thermal Coral	#FF7A6C	drive, saturation, intensity
Amber	#FFD36E	timing, transport, warnings
Matrix Lime	#B7FF6A	gates, levels, active signal
Mint	#68FFC2	envelopes, dynamics, smooth motion

6.3 Accent Rules

Within a section:

* active values glow in the section accent
* active icons use the section accent
* active LEDs use the section accent
* meters use dim-to-bright versions of the same accent
* outlines may use the section accent
* inactive states return to #373737

The full interface may use multiple colors, but each section should feel internally monochromatic.

Avoid rainbow UI. The accents should feel like a technical sectioning system, not RGB decoration.

⸻

7. Typography

Typography uses two distinct systems: one for labels, one for values.

7.1 Labels

Labels use one calm industrial type style.

Recommended typeface:

IBM Plex Sans Condensed SemiBold

Label styling:

Property	Rule
Case	Uppercase
Tracking	Wide
Weight	Medium to semibold
Color	Usually #373737
Rendering	Flat printed or lightly etched
Glow	Rare, only for active section headers
Bevel	None

Labels should feel like markings on hardware.

Examples:

FILTER
OSCILLATOR
SPREAD
MOTION
CHAOS
SPACE
DRIVE

Labels are not readouts. They should not feel like glowing data unless the section is active.

7.2 Values and Readouts

Values and readouts use:

Departure Mono

Departure Mono is a monospaced pixel font described by its repository as having a “lo-fi technical vibe,” and the project notes that it is inspired by early command-line and graphical interfaces, late-90s / early-00s tiny pixel fonts, and sci-fi film and television concepts. That makes it the required typeface for this style’s electronic readout language.  ￼

Use Departure Mono for:

* numbers
* values
* modes
* preset names
* status messages
* small display text
* technical readouts
* LED-style interface values

Value styling:

Property	Rule
Case	Usually uppercase
Color	Section accent
Rendering	Flat emissive light
Glow	Soft bloom
Placement	Inside displays or small readout zones
Bevel	None

For implementation, test sizes based on 11px increments, since the Departure Mono repo recommends 11px increments for pixel-perfect results.  ￼

The key distinction:

Labels are calm industrial markings. Values are electronic data.

⸻

8. Section Design

Interfaces with multiple sections should be organized by function.

Each major section must have:

* a clear functional identity
* one accent color
* one section label
* related controls
* optional etched grouping
* at least one Liquid Glass detail
* consistent internal spacing
* restrained use of display elements

Example section families:

Section	Typical Controls	Accent Direction
OSC	Unison, voices, gain, drift	Cyan or Ion Blue
FILTER	Cutoff, resonance, mix	Violet or Cyan
MOTION	Rate, depth, drift, sync	Mint
DRIVE	Heat, crush, feedback	Thermal Coral
SPACE	Width, spread, phase	Ion Blue or Violet
ENV	Attack, decay, sustain, release	Matrix Lime
ROUTE	Input, output, link, sync	Amber

Large section containers may have subtle structural depth. Internal controls should remain mostly flat.

⸻

9. Liquid Glass System

Liquid Glass is now a required detail system.

Every major section must include at least one small frosted, smoked, or liquid-glass element.

The Liquid Glass element should be:

* small
* intentional
* functional-looking
* tied to the section’s logic
* subtly tinted toward the section accent
* visually distinct from the matte controls
* used as a premium optical detail

The rest of the section remains matte, flat, and rubberized.

Liquid Glass should feel like:

* a lens
* a protective cover
* an optical lip
* a translucent skirt
* a tiny window
* a frosted rail
* a routing node

It should not become a large glassmorphism panel system.

9.1 Approved Liquid Glass Details

Detail Type	Best Use
Display lip	Over a recessed readout or value display
Knob skirt	Under one primary flat-topped knob
Meter cover	Over segmented LED meters
Icon lens	Over an important icon-forward control
Section tab	Beside a section label
Routing node	Where etched signal-flow lines converge
Button cover	Over one important action button
Edge rail	Along one section boundary

9.2 Recommended Liquid Glass Placement by Section

Section	Accent	Liquid Glass Detail
OSC	Cyan	translucent skirt under the main VOICES knob
FILTER	Violet	frosted lip over the cutoff readout
MOTION	Mint	glass-covered SYNC icon button
DRIVE	Coral	smoked cover over the saturation meter
SPACE	Ion Blue	circular lens over stereo-width icon
ENV	Lime	small routing node where envelope stages converge
ROUTE	Amber	thin glass rail beside input/output indicators

9.3 Liquid Glass Rendering

Liquid Glass may have:

* translucency
* soft blur
* slight refraction
* faint internal haze
* thin bright edge
* subtle highlight
* muted accent tint
* glow spill from the element beneath it

Liquid Glass should not have:

* large glossy highlights everywhere
* thick 3D bevels
* big floating panes
* full-section glass cards
* app-style glassmorphism
* random decorative use

Liquid Glass is the controlled exception to the small-scale flatness rule. Small highlights belong to glass details, not to every button and knob.

⸻

10. Knobs

Knobs are physical controls, but their tops should be restrained.

Knobs should look like flat-topped encoder caps.

They should have:

* flat #373737 top surface
* minimal perimeter definition
* subtle contact shadow
* optional thin rim line
* small indicator dash, dot, or notch
* optional Liquid Glass skirt underneath
* accent-color active marker

They should not have:

* strong radial gradients
* glossy highlights
* inflated convex centers
* bulbous plastic shading
* metallic realism
* heavy beveling

The knob can feel touchable without looking rounded and over-modeled.

A good knob reads as:

a flat dark control sitting on a matte synth panel.

⸻

11. Buttons

Buttons are primarily graphic interface elements with light physical presence.

Buttons should be:

* pill-shaped or rounded rectangular
* flat filled
* low-contrast when inactive
* clear through silhouette and spacing
* active through glow, outline, icon, or tiny LED

Inactive buttons usually use #373737 or a nearby dark variation.

Active buttons use the section accent color through:

* icon glow
* thin outline
* tiny status dot
* illuminated edge
* subtle halo
* value change

Buttons should not use convex gradient shading as their main visual language.

A button may lift slightly from the surface, but it should not look inflated.

⸻

12. Displays and Readouts

Displays are one of the main places where depth is allowed.

A display may be:

* recessed
* inset into the faceplate
* protected by a smoked glass lip
* surrounded by a subtle rim
* dark inside
* softly illuminated by its contents

The display container can have depth. The information inside the display should remain flat and emissive.

Display contents may include:

* Departure Mono values
* segmented bars
* dot-like indicators
* simple icons
* small waveform graphics
* status messages
* short technical labels

The content should feel like light or data, not raised plastic.

⸻

13. LED Meters and Indicators

Meters should be geometric and flat.

Use:

* small squares
* dots
* short bars
* segmented horizontal meters
* tiny vertical level stacks
* small status LEDs

Active segments use the section accent color with soft bloom.

Inactive segments use dark gray, usually near #373737.

Avoid beveled LED blocks. The segments should feel like light windows or illuminated graphics, not little raised gems.

A smoked Liquid Glass meter cover is encouraged for at least one major meter section.

⸻

14. Etched Control Groupings

Etched groupings show logical relationships between controls.

They are inspired by modular synth panels, signal-flow diagrams, and technical faceplate markings.

Use them for:

* grouped parameters
* signal flow
* related controls
* modulation paths
* input/output relationships
* section structure

Etchings should be:

* thin
* minimal
* functional
* low-contrast
* mostly #373737
* optionally dimmed toward the section accent
* flat or barely engraved

They should not become decorative sci-fi ornament.

A good etched grouping might be a simple three-pronged line connecting:

CUTOFF
RES
MIX

with the group label:

FILTER

Where these etched lines converge, a small Liquid Glass routing node can be used.

⸻

15. Icon-Forward Design

The interface favors symbols when the meaning is established.

Text is used when:

* the icon would be ambiguous
* the control is specialized
* the section needs a title
* the value needs a label
* the label is part of the instrument identity

Preferred icon language:

Concept	Icon Direction
Stereo width	overlapping circles
Sync	circular arrows
Power	power glyph
Play / pause	transport icons
Random	shuffle symbol or dice
Phase	waveform, split wave, or phase-circle
Link	chain
Lock	lock
Signal flow	arrows or branching paths
Modulation	wave or orbital curve

Icons should be:

* simple line icons
* flat
* geometric
* low-detail
* visually technical
* inactive in #373737
* active in the section accent color

Icons should not be beveled, embossed, illustrated, emoji-like, or cartoonish.

A major icon in a section is a good candidate for a Liquid Glass lens.

⸻

16. Lighting

Lighting should describe the whole object, not every individual control.

Use:

* soft studio lighting
* broad gentle falloff
* subtle chassis shadow
* soft panel occlusion
* restrained rim definition
* glow from emissive elements
* small contact shadows where controls meet the surface
* selective highlights only on Liquid Glass details

Avoid assigning a separate visible lighting model to every small element.

The faceplate should not look like a field of tiny shaded bumps.

The main dimensional cues should come from:

1. the chassis silhouette
2. major panels
3. recessed displays
4. cast/contact shadows
5. Liquid Glass details
6. emissive glow

Not from gradient shading on every control.

⸻

17. Composition

The interface should feel designed, not decorated.

Use:

* clean alignment
* grid-based spacing
* strong section hierarchy
* restrained density
* clear signal grouping
* repeated control patterns
* consistent icon scale
* generous negative space around important displays

The layout should feel like premium audio hardware, modular synth equipment, and sci-fi instrumentation.

It should not feel like:

* a busy spaceship cockpit
* a gaming keyboard
* a toy controller
* a generic glass app UI
* a random collection of glowing sci-fi shapes

⸻

18. Depth Permission Matrix

Element	Depth Permission
Outer chassis	Subtle bevel and shadow allowed
Major section panel	Subtle lift or recess allowed
Large display well	Recess and inner shadow allowed
Display contents	Flat emissive only
Knob cap	Mostly flat, minimal edge definition
Knob base / skirt	Liquid Glass allowed
Button	Mostly flat, small contact shadow allowed
Icons	Flat linework only
Labels	Flat printed or lightly etched only
Values	Flat emissive Departure Mono
LED segments	Flat emissive blocks/dots
Etched grouping lines	Flat or barely engraved
Liquid Glass detail	Small-scale highlight/refraction allowed

⸻

19. Quality Bar

A design succeeds when it feels:

* premium
* synthetic
* technical
* controlled
* matte
* precise
* musical
* sci-fi but not noisy
* tactile but not bumpy
* colorful by section, not rainbow
* glass-detailed, not glass-dominated

A design fails when it feels:

* overly beveled
* bubbly
* toy-like
* glossy
* randomly RGB
* overdecorated
* too photorealistic
* too flat-app-like
* cluttered with meaningless sci-fi lines
* covered in glassmorphism panels

⸻

20. Final Definition

This style is a dark matte hardware interface system built around a #1C1C1C rubberized faceplate, #373737 flat controls and markings, section-specific neon emissive accents, Departure Mono value readouts, condensed industrial labels, modular synth-style etched groupings, icon-forward controls, required small Liquid Glass details in every major section, and selective physical depth reserved mainly for large structural forms and recessed display areas.