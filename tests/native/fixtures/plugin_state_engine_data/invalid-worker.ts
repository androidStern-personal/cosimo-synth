// Explicit worker fixture: automatic stateSource builds reject this bad
// declaration before shipping. This exercises the separate QuickJS import-error
// boundary, where native notifications must preserve the original diagnostic.
import definition from "./state";
import { createCmajorPluginStateService } from "../../kit/ui/plugin-state-cmajor";
export default (connection: Parameters<typeof createCmajorPluginStateService>[1]) =>
    createCmajorPluginStateService(definition, connection, { onDefect: console.error });
