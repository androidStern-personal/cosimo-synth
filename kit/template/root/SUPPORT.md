# Setup help

For purchase, lost delivery, or access problems, use the support contact in your
receipt or download page. Include the order reference and the short error
message. Never send your personalized install command, private download link,
access token, payment details, or entire project.

For refund requests, contact support with the reason for your request. We review
each request individually.

## Quick checks

| Problem | Next step |
| --- | --- |
| Setup was interrupted | Run the same delivery command again. It resumes its own folder and preserves edits. If it reports a stale lock or an altered tool, ask for help before deleting anything. |
| Destination folder already exists | Use an empty new destination through delivery recovery. Do not remove an unrelated folder to make installation proceed. |
| Apple tools or agreements are missing | Complete the reported Apple prerequisite yourself, then rerun the same command. The installer does not accept agreements or use administrator privileges. |
| Access denied or download unavailable | Check connectivity, then recover the delivery from your receipt or contact support. Do not paste the private address into a public issue. |
| Tool checksum or verification fails | Stop. Keep the error and ask for setup help; do not bypass the check or substitute a downloaded tool. |
| Build command fails | Keep the first failing command and its error. Ask the agent to run the diagnostic below before changing source. |
| Plugin is absent in the DAW | Check the exact name and installed path reported by the installer, the DAW's VST3 setting, and its rescan instructions. Close the plugin before replacing it. |
| Plugin sounds unchanged | Increase Amount, check routing and host bypass, and audition with audio. The optional browser preview has no audio engine. |
| Update conflicts or fails | Follow [Updates and recovery](UPDATING.md); keep the checkpoint and the installed working plugin. |

## Small diagnostic report

Ask your agent:

> Diagnose this setup problem without changing my source or installed plugins. Run kit:doctor, summarize the failing check, and prepare a short report with private addresses and personal paths removed.

For the agent, from the project root (activate the installer runtime as directed
in `AGENTS.md`):

```sh
npm run kit:doctor -- --json --offline
git status --short --branch
git rev-parse HEAD
```

These commands inspect local state without fetching or installing. A doctor
report lists tool versions, kit version, platform, and dependency checks;
offline mode does not test download access. Review its paths before sharing.
Add your DAW/version, first failing command, short error, and whether the plugin
ever worked. Share the selected report, not a full log or repository archive.

Support covers purchase/download and genuine setup problems. It does not
include custom algorithms, bespoke development, or merging your modifications.
