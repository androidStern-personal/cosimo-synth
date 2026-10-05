# Native VST3 installation

`fx:prod:install` and `cmajplugin:install` are development conveniences that copy a bundle the kit just built or downloaded into `~/Library/Audio/Plug-Ins/VST3`; they are not a product installer.
Each one checks the bundle's code signature and patched CHOC WebView markers, copies it beside the destination, replaces the previous copy, checks the installed bundle again, and prints its path.
The bundle keeps the signature the build gave it; installation never re-signs.
A plugin renamed through `previousProductName` has its old `<previousProductName>.vst3` removed after the new bundle verifies.
This replaced a transactional installer with identity probes and recovery folders: for a developer installing their own fresh builds, that cost 1,200 lines and a native helper, while a copy that fails here already leaves the previous bundle in place.
