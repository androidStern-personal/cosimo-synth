export default function runWorker(connection) {
    connection.addStoredStateValueListener((message) => {
        if (message.key === "quickjs.error.probe") {
            throw new Error("intentional QuickJS worker delivery failure");
        }
    });
}
