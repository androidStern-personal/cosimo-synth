# Try a modification: Wavefold

First try the included plugin in your DAW. When you want an example of what
source editing makes possible, give your agent this request:

> Add Wavefold as a third Character choice after Tube and Solid. Keep Tube and Solid sounding the same and keep their saved values. Wavefold should fold the selected band's signal back on itself as it gets louder, with more folding at Medium intensity. Preserve the existing routing, shapes, Amount controls, spectrum, presets, and snapshots. Give this version a solid warm orange surface (#E8753D), dark readable text, and no neon glow or gradients. Keep Mid and Side distinguishable. Work on a separate examples/wavefold branch after checking that my work is safely saved. Use a separate plugin identity and install filename for this example so I can keep the original installed. Verify the sound processing, saved Wavefold choice, and real interface before building and installing. Do not commit, stash, or discard existing uncommitted changes for me.

The example keeps the existing controls. Tube is still value 0, Solid is still
1, and Wavefold is 2. The reference uses a bounded, symmetric triangle fold
inside the existing oversampled signal path. Amount zero remains dry. This
illustrates one specific change; the time and work needed for another request
will vary.

Your agent should inspect DSP, host endpoints, saved-state parsing, interface
controls, and tests together. Changes belong in the plugin and its tests,
leaving `kit/` available for upstream updates. Changing the example's identity
also gives it its own preset storage; the original remains available for
comparison. New Wavefold presets require the modified plugin.

To hear it, try a sustained bass note or a simple drum loop, then compare Tube,
Solid, and Wavefold at the same Frequency, Shape, Amount, and Intensity. Adjust
monitoring level for a fair comparison. Save the Wavefold setting in a DAW
project, close and reopen the editor, then reopen the saved project.

You can ask for another algorithm or your own visual treatment instead.
Preview/build/test results and your listening judgment are separate checks.
