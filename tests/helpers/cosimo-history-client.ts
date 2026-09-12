import { createCmajorPluginStateClient, type CmajorStateConnection } from "../../kit/ui/plugin-state-cmajor";
import { synthPluginState } from "../../ui/shared/synth-plugin-state";

type ViewHost = CmajorStateConnection & {
    createViewConnection(): CmajorStateConnection & { dispose(): void };
};

// A real second view needs its own channel identity. The production GUI already
// owns the host/root connection; sharing it would replace the GUI attachment.
export function connect(connection: ViewHost) {
    const view = connection.createViewConnection();
    const client = createCmajorPluginStateClient(synthPluginState, view, {
        onDefect(error) { throw error; },
    });
    return {
        getSnapshot: () => client.getSnapshot(),
        dispatch: client.dispatch,
        stop() { client.stop(); view.dispose(); },
    };
}
