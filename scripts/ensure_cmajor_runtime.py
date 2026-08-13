#!/usr/bin/env python3
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
RUNTIME_GIT_URL = "https://github.com/cmajor-lang/cmajor.git"
RUNTIME_TAG = "1.0.3066"
RUNTIME_COMMIT = "172db53232337154d5a1c0f9a448318129dfacd9"
PATCHED_CHOC_GIT_URL = "https://github.com/androidStern/choc.git"
PATCHED_CHOC_BRANCH = "cosimo-keyboard-bridge"
PATCHED_CHOC_COMMIT = "e50b21a272a1729bc1dd1fd368c112095cb18d5a"
PATCHED_CHOC_SHORT_COMMIT = PATCHED_CHOC_COMMIT[:8]
RUNTIME_DESTINATION = REPO_ROOT / "build" / "deps" / f"cmajor-{RUNTIME_TAG}-choc-{PATCHED_CHOC_SHORT_COMMIT}"
PATCHED_CHOC_MARKERS = (
    "chocHostKeyboard",
    "__chocHostKeyboardBridgeInstalled",
    "__chocUserFiles",
    "chocUserFiles",
    "COSIMO_HOST_KEYBOARD_RELAY_PROCESS_NAME",
    "cosimo-standalone-keyboard",
    "hostKeyboardShouldRelayToPlugin",
)
CMAJOR_JUCE_SIDECHAIN_PATCH_MARKER = "COSIMO_CMAJOR_JUCE_PLUGIN_SPLIT_INPUT_BUSES"
CHOC_QUICKJS_PENDING_JOB_PATCH_MARKER = "COSIMO_CHOC_QUICKJS_DRAIN_PENDING_JOBS"
CHOC_TIMER_CLEAR_TIMEOUT_PATCH_MARKER = "COSIMO_CHOC_TIMER_CLEAR_TIMEOUT"
CMAJOR_PATCH_WORKER_QUEUE_PATCH_MARKER = "COSIMO_CMAJOR_PATCH_WORKER_REENTRANT_QUEUE"
CMAJOR_PATCH_WORKER_LIFETIME_PATCH_MARKER = "COSIMO_CMAJOR_PATCH_WORKER_EARLY_DETACH"
CMAJOR_PATCH_WORKER_NONFATAL_ERROR_PATCH_MARKER = "COSIMO_CMAJOR_PATCH_WORKER_NONFATAL_ERROR"
CMAJOR_STORED_STATE_STRING_COMPARISON_PATCH_MARKER = "COSIMO_CMAJOR_STORED_STATE_STRING_CONTENT_COMPARISON"
CMAJOR_QUICKJS_RESOURCE_BRIDGE_PATCH_MARKER = "COSIMO_CMAJOR_QUICKJS_RESOURCE_BRIDGE"
CMAJOR_EXTERNAL_FUNCTION_PROVIDER_PATCH_MARKER = "COSIMO_CMAJOR_PATCH_EXTERNAL_FUNCTION_PROVIDER"

HOST_KEYBOARD_RELAY_HELPERS = r'''
    static bool hostKeyboardShouldRelayToPlugin (const choc::value::ValueView& payload)
    {
#ifdef COSIMO_HOST_KEYBOARD_RELAY_PROCESS_NAME
        auto reason = hostKeyboardGetStringMember (payload, "reason");

        if (reason != "ableton-musical-typing-key" && reason != "matching-forwarded-keyup")
            return false;

        auto processInfo = objc::callClass<id> ("NSProcessInfo", "processInfo");
        auto processName = objc::getString (objc::call<id> (processInfo, "processName"));
        return processName == COSIMO_HOST_KEYBOARD_RELAY_PROCESS_NAME;
#else
        (void) payload;
        return false;
#endif
    }

    static std::string hostKeyboardBoolLiteral (bool value)
    {
        return value ? "true" : "false";
    }

    void relayBufferedKeyboardEventToPlugin (const choc::value::ValueView& payload)
    {
        auto script = std::string (R"CHOCRELAYJS(
(() => {
  const payload = {
    source: "cosimo-standalone-keyboard",
    eventType: )CHOCRELAYJS")
            + choc::json::getEscapedQuotedString (hostKeyboardGetStringMember (payload, "eventType")) + R"CHOCRELAYJS(,
    key: )CHOCRELAYJS"
            + choc::json::getEscapedQuotedString (hostKeyboardGetStringMember (payload, "key")) + R"CHOCRELAYJS(,
    code: )CHOCRELAYJS"
            + choc::json::getEscapedQuotedString (hostKeyboardGetStringMember (payload, "code")) + R"CHOCRELAYJS(,
    repeat: )CHOCRELAYJS"
            + hostKeyboardBoolLiteral (hostKeyboardGetBoolMember (payload, "repeat")) + R"CHOCRELAYJS(,
    shiftKey: )CHOCRELAYJS"
            + hostKeyboardBoolLiteral (hostKeyboardGetBoolMember (payload, "shiftKey")) + R"CHOCRELAYJS(,
    ctrlKey: )CHOCRELAYJS"
            + hostKeyboardBoolLiteral (hostKeyboardGetBoolMember (payload, "ctrlKey")) + R"CHOCRELAYJS(,
    altKey: )CHOCRELAYJS"
            + hostKeyboardBoolLiteral (hostKeyboardGetBoolMember (payload, "altKey")) + R"CHOCRELAYJS(,
    metaKey: )CHOCRELAYJS"
            + hostKeyboardBoolLiteral (hostKeyboardGetBoolMember (payload, "metaKey")) + R"CHOCRELAYJS(
  };

  window.postMessage(payload, "*");

  for (const frame of Array.from(window.frames)) {
    try {
      frame.postMessage(payload, "*");
    } catch {}
  }
})();
)CHOCRELAYJS";

        evaluateJavascript (script, {});
    }
'''

HOST_KEYBOARD_RELAY_FORWARD_BLOCK = r'''                if (hostKeyboardShouldRelayToPlugin (payload))
                {
                    auto result = discardBufferedKeyboardEvent (payload);
                    relayBufferedKeyboardEventToPlugin (payload);
                    logHostKeyboard ("forward-request result=relayed"
                                     + std::string (" stage=") + result.stage
                                     + " detail=" + result.detail
                                     + " eventType=" + hostKeyboardGetStringMember (payload, "eventType")
                                     + " key=" + hostKeyboardGetStringMember (payload, "key")
                                     + " code=" + hostKeyboardGetStringMember (payload, "code")
                                     + " reason=" + hostKeyboardGetStringMember (payload, "reason"));
                    return;
                }

'''


def _run(command: list[str], *, cwd: Path | None = None, capture: bool = False) -> subprocess.CompletedProcess[str]:
    if capture:
        return subprocess.run(
            command,
            cwd=cwd,
            check=True,
            text=True,
            capture_output=True,
        )

    return subprocess.run(
        command,
        cwd=cwd,
        check=True,
        text=True,
        stdout=sys.stderr,
    )


def _replace_unique_anchor(
    source: str,
    anchor: str,
    replacement: str,
    *,
    label: str,
    path: Path,
) -> str:
    match_count = source.count(anchor)

    if match_count != 1:
        raise RuntimeError(
            f"Could not apply {label} in {path}: expected exactly one anchor, found {match_count}."
        )

    return source.replace(anchor, replacement, 1)


def _runtime_looks_complete(runtime_root: Path) -> bool:
    required_paths = (
        runtime_root / ".git",
        runtime_root / "include" / "cmajor" / "helpers" / "cmaj_Patch.h",
        runtime_root / "include" / "choc" / "choc" / "gui" / "choc_WebView.h",
        runtime_root / "javascript" / "cmaj_api" / "cmaj-patch-view.js",
        runtime_root / "3rdParty" / "llvm" / "release" / "osx" / "universal" / "cmake_platforms",
        runtime_root / "3rdParty" / "boost" / "asio" / "include" / "boost" / "asio.hpp",
    )
    return all(path.exists() for path in required_paths)


def _choc_head(runtime_root: Path) -> str | None:
    choc_root = runtime_root / "include" / "choc"

    if not choc_root.exists():
        return None

    try:
        return _run(["git", "rev-parse", "HEAD"], cwd=choc_root, capture=True).stdout.strip()
    except subprocess.CalledProcessError:
        return None


def _runtime_contains_required_choc_patches(runtime_root: Path) -> bool:
    webview_header = runtime_root / "include" / "choc" / "choc" / "gui" / "choc_WebView.h"

    if not webview_header.exists():
        return False

    header_text = webview_header.read_text(encoding="utf-8")
    return all(marker in header_text for marker in PATCHED_CHOC_MARKERS)


def _apply_cosimo_choc_keyboard_relay_patch(runtime_root: Path) -> None:
    webview_header = runtime_root / "include" / "choc" / "choc" / "gui" / "choc_WebView.h"

    if not webview_header.exists():
        return

    header_text = webview_header.read_text(encoding="utf-8")

    if "hostKeyboardShouldRelayToPlugin" in header_text:
        return

    age_function = """    static int64_t hostKeyboardAgeMs (std::chrono::steady_clock::time_point capturedAt)
    {
        return std::chrono::duration_cast<std::chrono::milliseconds> (std::chrono::steady_clock::now() - capturedAt).count();
    }
"""
    header_text = _replace_unique_anchor(
        header_text,
        age_function,
        age_function + HOST_KEYBOARD_RELAY_HELPERS,
        label="Cosimo keyboard relay helper patch",
        path=webview_header,
    )

    forward_call = "                auto result = forwardBufferedKeyboardEventToHost (payload);\n"
    header_text = _replace_unique_anchor(
        header_text,
        forward_call,
        HOST_KEYBOARD_RELAY_FORWARD_BLOCK + forward_call,
        label="Cosimo keyboard relay forwarding patch",
        path=webview_header,
    )
    webview_header.write_text(header_text, encoding="utf-8")


def _runtime_contains_quickjs_pending_job_patch(runtime_root: Path) -> bool:
    quickjs_header = runtime_root / "include" / "choc" / "choc" / "javascript" / "choc_javascript_QuickJS.h"

    if not quickjs_header.exists():
        return False

    return CHOC_QUICKJS_PENDING_JOB_PATCH_MARKER in quickjs_header.read_text(encoding="utf-8")


def _apply_choc_quickjs_pending_job_patch(runtime_root: Path) -> None:
    quickjs_header = runtime_root / "include" / "choc" / "choc" / "javascript" / "choc_javascript_QuickJS.h"

    if not quickjs_header.exists():
        raise RuntimeError(f"CHOC QuickJS header not found: {quickjs_header}")

    header_text = quickjs_header.read_text(encoding="utf-8")

    if CHOC_QUICKJS_PENDING_JOB_PATCH_MARKER in header_text:
        return

    old_message_loop = """    void pumpMessageLoop() override {}

    void pushObjectOrArray (const choc::value::ValueView& v) override { functionArgs.push_back (valueToJS (v).release()); }
"""
    new_message_loop = f"""    void pumpMessageLoop() override {{}}

    // {CHOC_QUICKJS_PENDING_JOB_PATCH_MARKER}
    void drainPendingJobs()
    {{
        for (;;)
        {{
            JSContext* pendingContext = nullptr;
            const auto status = JS_ExecutePendingJob (runtime, &pendingContext);

            if (status == 0)
                return;

            if (status < 0)
            {{
                auto* exceptionContext = pendingContext != nullptr ? pendingContext : context;
                auto exception = JS_GetException (exceptionContext);
                auto message = JS_ToCString (exceptionContext, exception);
                std::string error = message != nullptr ? message : "QuickJS pending job failed";

                if (message != nullptr)
                    JS_FreeCString (exceptionContext, message);

                JS_FreeValue (exceptionContext, exception);
                throw Error (error);
            }}
        }}
    }}

    void pushObjectOrArray (const choc::value::ValueView& v) override {{ functionArgs.push_back (valueToJS (v).release()); }}
"""
    old_evaluate_expression = """    choc::value::Value evaluateExpression (const std::string& code) override
    {
        return takeValue (JS_Eval (context, code.c_str(), code.size(), "", JS_EVAL_TYPE_GLOBAL)).toChocValue();
    }
"""
    new_evaluate_expression = """    choc::value::Value evaluateExpression (const std::string& code) override
    {
        auto result = takeValue (JS_Eval (context, code.c_str(), code.size(), "", JS_EVAL_TYPE_GLOBAL));
        auto value = result.toChocValue();
        drainPendingJobs();
        return value;
    }
"""
    old_module_result = """                auto result = takeValue (JS_Eval (context, code.c_str(), code.size(), "", JS_EVAL_TYPE_MODULE));
                JS_SetModuleLoaderFunc (runtime, nullptr, nullptr, nullptr);

                if (handleResult)
                    handleResult ({}, result.toChocValue());
"""
    new_module_result = """                auto result = takeValue (JS_Eval (context, code.c_str(), code.size(), "", JS_EVAL_TYPE_MODULE));
                JS_SetModuleLoaderFunc (runtime, nullptr, nullptr, nullptr);
                auto value = handleResult ? result.toChocValue() : choc::value::Value {};
                drainPendingJobs();

                if (handleResult)
                    handleResult ({}, value);
"""
    old_script_result = """                auto result = takeValue (JS_Eval (context, code.c_str(), code.size(), "", JS_EVAL_TYPE_GLOBAL));

                if (handleResult)
                    handleResult ({}, result.toChocValue());
"""
    new_script_result = """                auto result = takeValue (JS_Eval (context, code.c_str(), code.size(), "", JS_EVAL_TYPE_GLOBAL));
                auto value = handleResult ? result.toChocValue() : choc::value::Value {};
                drainPendingJobs();

                if (handleResult)
                    handleResult ({}, value);
"""
    old_perform_call_return = """        functionArgs.clear();
        return returnVal.toChocValue();
"""
    new_perform_call_return = """        functionArgs.clear();
        auto value = returnVal.toChocValue();
        drainPendingJobs();
        return value;
"""
    replacements = (
        (old_message_loop, new_message_loop, "QuickJS context"),
        (old_evaluate_expression, new_evaluate_expression, "evaluateExpression"),
        (old_module_result, new_module_result, "module evaluation"),
        (old_script_result, new_script_result, "script evaluation"),
        (old_perform_call_return, new_perform_call_return, "native invocation"),
    )

    patched_text = header_text

    for old, new, label in replacements:
        patched_text = _replace_unique_anchor(
            patched_text,
            old,
            new,
            label=f"CHOC QuickJS pending-job {label} patch",
            path=quickjs_header,
        )

    quickjs_header.write_text(patched_text, encoding="utf-8")

    if not _runtime_contains_quickjs_pending_job_patch(runtime_root):
        raise RuntimeError(f"CHOC QuickJS pending-job patch marker was not written to {quickjs_header}.")


def _runtime_contains_timer_clear_timeout_patch(runtime_root: Path) -> bool:
    timer_header = runtime_root / "include" / "choc" / "choc" / "javascript" / "choc_javascript_Timer.h"

    if not timer_header.exists():
        return False

    return CHOC_TIMER_CLEAR_TIMEOUT_PATCH_MARKER in timer_header.read_text(encoding="utf-8")


def _apply_choc_timer_clear_timeout_patch(runtime_root: Path) -> None:
    timer_header = runtime_root / "include" / "choc" / "choc" / "javascript" / "choc_javascript_Timer.h"

    if not timer_header.exists():
        raise RuntimeError(f"CHOC JavaScript timer header not found: {timer_header}")

    header_text = timer_header.read_text(encoding="utf-8")

    if CHOC_TIMER_CLEAR_TIMEOUT_PATCH_MARKER in header_text:
        return

    old_clear_interval = """function clearInterval (timerID)
{
    _choc_activeTimers[timerID] = undefined;
    _choc_clearInterval (timerID | 0);
}
"""
    new_clear_interval = f"""function clearInterval (timerID)
{{
    _choc_activeTimers[timerID] = undefined;
    _choc_clearInterval (timerID | 0);
}}

// {CHOC_TIMER_CLEAR_TIMEOUT_PATCH_MARKER}
function clearTimeout (timerID)
{{
    clearInterval (timerID);
}}
"""

    timer_header.write_text(
        _replace_unique_anchor(
            header_text,
            old_clear_interval,
            new_clear_interval,
            label="CHOC timer clearTimeout patch",
            path=timer_header,
        ),
        encoding="utf-8",
    )

    if not _runtime_contains_timer_clear_timeout_patch(runtime_root):
        raise RuntimeError(f"CHOC timer clearTimeout patch marker was not written to {timer_header}.")


def _runtime_contains_patch_worker_queue_patch(runtime_root: Path) -> bool:
    patch_header = runtime_root / "include" / "cmajor" / "helpers" / "cmaj_Patch.h"

    if not patch_header.exists():
        return False

    return CMAJOR_PATCH_WORKER_QUEUE_PATCH_MARKER in patch_header.read_text(encoding="utf-8")


def _apply_cmajor_patch_worker_queue_patch(runtime_root: Path) -> None:
    patch_header = runtime_root / "include" / "cmajor" / "helpers" / "cmaj_Patch.h"

    if not patch_header.exists():
        raise RuntimeError(f"Cmajor patch helper not found: {patch_header}")

    header_text = patch_header.read_text(encoding="utf-8")

    if CMAJOR_PATCH_WORKER_QUEUE_PATCH_MARKER in header_text:
        return

    old_queue_flush = """        {
            std::unique_lock<std::mutex> l (m);

            for (size_t i = 0; i < queuedSendMessageRequests.size(); i++)
                queuedSendMessageRequests[i]();

            queuedSendMessageRequests.clear();
            patchWorkerInitialised = true;
        }
"""
    new_queue_flush = f"""        // {CMAJOR_PATCH_WORKER_QUEUE_PATCH_MARKER}
        std::vector<std::function<void()>> requestsToDeliver;

        {{
            std::unique_lock<std::mutex> l (m);
            patchWorkerInitialised = true;
            requestsToDeliver.swap (queuedSendMessageRequests);
        }}

        for (auto& request : requestsToDeliver)
            request();
"""

    patch_header.write_text(
        _replace_unique_anchor(
            header_text,
            old_queue_flush,
            new_queue_flush,
            label="Cmajor patch-worker queue patch",
            path=patch_header,
        ),
        encoding="utf-8",
    )

    if not _runtime_contains_patch_worker_queue_patch(runtime_root):
        raise RuntimeError(f"Cmajor patch-worker queue patch marker was not written to {patch_header}.")


def _runtime_contains_patch_worker_lifetime_patch(runtime_root: Path) -> bool:
    patch_header = runtime_root / "include" / "cmajor" / "helpers" / "cmaj_Patch.h"

    if not patch_header.exists():
        return False

    return CMAJOR_PATCH_WORKER_LIFETIME_PATCH_MARKER in patch_header.read_text(encoding="utf-8")


def _apply_cmajor_patch_worker_lifetime_patch(runtime_root: Path) -> None:
    patch_header = runtime_root / "include" / "cmajor" / "helpers" / "cmaj_Patch.h"

    if not patch_header.exists():
        raise RuntimeError(f"Cmajor patch helper not found: {patch_header}")

    header_text = patch_header.read_text(encoding="utf-8")

    if CMAJOR_PATCH_WORKER_LIFETIME_PATCH_MARKER in header_text:
        return

    old_destructor = """    ~PatchWorker() override
    {
        initCallback.reset();
        sendMessageCallback.reset();
        setErrorCallback.reset();
        context = {};
    }
"""
    new_destructor = f"""    ~PatchWorker() override
    {{
        // {CMAJOR_PATCH_WORKER_LIFETIME_PATCH_MARKER}
        // PatchView's base destructor runs after these members are destroyed.
        // Detach first so queued client events cannot call a half-destroyed worker.
        setActive (false);
        initCallback.reset();
        sendMessageCallback.reset();
        setErrorCallback.reset();
        context = {{}};
    }}
"""

    patch_header.write_text(
        _replace_unique_anchor(
            header_text,
            old_destructor,
            new_destructor,
            label="Cmajor patch-worker lifetime patch",
            path=patch_header,
        ),
        encoding="utf-8",
    )

    if not _runtime_contains_patch_worker_lifetime_patch(runtime_root):
        raise RuntimeError(f"Cmajor patch-worker lifetime patch marker was not written to {patch_header}.")


def _runtime_contains_patch_worker_nonfatal_error_patch(runtime_root: Path) -> bool:
    patch_header = runtime_root / "include" / "cmajor" / "helpers" / "cmaj_Patch.h"

    if not patch_header.exists():
        return False

    return CMAJOR_PATCH_WORKER_NONFATAL_ERROR_PATCH_MARKER in patch_header.read_text(encoding="utf-8")


def _apply_cmajor_patch_worker_nonfatal_error_patch(runtime_root: Path) -> None:
    patch_header = runtime_root / "include" / "cmajor" / "helpers" / "cmaj_Patch.h"

    if not patch_header.exists():
        raise RuntimeError(f"Cmajor patch helper not found: {patch_header}")

    header_text = patch_header.read_text(encoding="utf-8")

    if CMAJOR_PATCH_WORKER_NONFATAL_ERROR_PATCH_MARKER in header_text:
        return

    old_worker_error_handler = """        setErrorCallback = [&p] (const std::string& error)
        {
            p.setErrorStatus ("Error in patch worker script: " + error,
                              p.getManifest() != nullptr ? p.getManifest()->patchWorker : std::string(),
                              {}, true);
        };
"""
    new_worker_error_handler = f"""        setErrorCallback = [&p] (const std::string& error)
        {{
            // {CMAJOR_PATCH_WORKER_NONFATAL_ERROR_PATCH_MARKER}
            p.setErrorStatus ("Error in patch worker script: " + error,
                              p.getManifest() != nullptr ? p.getManifest()->patchWorker : std::string(),
                              {{}}, false);
        }};
"""

    patch_header.write_text(
        _replace_unique_anchor(
            header_text,
            old_worker_error_handler,
            new_worker_error_handler,
            label="Cmajor nonfatal patch-worker error policy",
            path=patch_header,
        ),
        encoding="utf-8",
    )

    if not _runtime_contains_patch_worker_nonfatal_error_patch(runtime_root):
        raise RuntimeError(f"Cmajor nonfatal patch-worker error marker was not written to {patch_header}.")


def _runtime_contains_stored_state_string_comparison_patch(runtime_root: Path) -> bool:
    patch_header = runtime_root / "include" / "cmajor" / "helpers" / "cmaj_Patch.h"

    if not patch_header.exists():
        return False

    return CMAJOR_STORED_STATE_STRING_COMPARISON_PATCH_MARKER in patch_header.read_text(encoding="utf-8")


def _apply_cmajor_stored_state_string_comparison_patch(runtime_root: Path) -> None:
    patch_header = runtime_root / "include" / "cmajor" / "helpers" / "cmaj_Patch.h"

    if not patch_header.exists():
        raise RuntimeError(f"Cmajor patch helper not found: {patch_header}")

    header_text = patch_header.read_text(encoding="utf-8")

    if CMAJOR_STORED_STATE_STRING_COMPARISON_PATCH_MARKER in header_text:
        return

    old_stored_state_comparison = """    auto& v = storedState[key];

    if (v != newValue)
"""
    new_stored_state_comparison = f"""    auto& v = storedState[key];

    // {CMAJOR_STORED_STATE_STRING_COMPARISON_PATCH_MARKER}
    // CHOC string handles are local to each Value dictionary, so equal numeric
    // handles do not imply equal text when values came from different messages.
    const auto valuesMatch = v.isString() && newValue.isString()
        ? v.getString() == newValue.getString()
        : v == newValue;

    if (! valuesMatch)
"""

    patch_header.write_text(
        _replace_unique_anchor(
            header_text,
            old_stored_state_comparison,
            new_stored_state_comparison,
            label="Cmajor stored-state string comparison patch",
            path=patch_header,
        ),
        encoding="utf-8",
    )

    if not _runtime_contains_stored_state_string_comparison_patch(runtime_root):
        raise RuntimeError(f"Cmajor stored-state string comparison patch marker was not written to {patch_header}.")


def _runtime_contains_quickjs_resource_bridge_patch(runtime_root: Path) -> bool:
    worker_header = runtime_root / "include" / "cmajor" / "helpers" / "cmaj_PatchWorker_QuickJS.h"

    if not worker_header.exists():
        return False

    return CMAJOR_QUICKJS_RESOURCE_BRIDGE_PATCH_MARKER in worker_header.read_text(encoding="utf-8")


def _apply_cmajor_quickjs_resource_bridge_patch(runtime_root: Path) -> None:
    worker_header = runtime_root / "include" / "cmajor" / "helpers" / "cmaj_PatchWorker_QuickJS.h"

    if not worker_header.exists():
        raise RuntimeError(f"Cmajor QuickJS patch-worker helper not found: {worker_header}")

    header_text = worker_header.read_text(encoding="utf-8")

    if CMAJOR_QUICKJS_RESOURCE_BRIDGE_PATCH_MARKER in header_text:
        return

    old_connection_setup = """const connection = new WorkerPatchConnection();

connection.readResource = (path) =>
"""
    new_connection_setup = f"""const connection = new WorkerPatchConnection();

// {CMAJOR_QUICKJS_RESOURCE_BRIDGE_PATCH_MARKER}
connection.prefersAudioResourceReadBridge = true;

connection.readResource = (path) =>
"""

    worker_header.write_text(
        _replace_unique_anchor(
            header_text,
            old_connection_setup,
            new_connection_setup,
            label="Cmajor QuickJS resource-bridge patch",
            path=worker_header,
        ),
        encoding="utf-8",
    )

    if not _runtime_contains_quickjs_resource_bridge_patch(runtime_root):
        raise RuntimeError(f"Cmajor QuickJS resource-bridge patch marker was not written to {worker_header}.")


def _runtime_contains_external_function_provider_patch(runtime_root: Path) -> bool:
    patch_header = runtime_root / "include" / "cmajor" / "helpers" / "cmaj_Patch.h"

    if not patch_header.exists():
        return False

    return CMAJOR_EXTERNAL_FUNCTION_PROVIDER_PATCH_MARKER in patch_header.read_text(encoding="utf-8")


def _apply_cmajor_external_function_provider_patch(runtime_root: Path) -> None:
    patch_header = runtime_root / "include" / "cmajor" / "helpers" / "cmaj_Patch.h"

    if not patch_header.exists():
        raise RuntimeError(f"Cmajor patch helper not found: {patch_header}")

    header_text = patch_header.read_text(encoding="utf-8")

    if CMAJOR_EXTERNAL_FUNCTION_PROVIDER_PATCH_MARKER in header_text:
        return

    old_create_engine = """    std::function<cmaj::Engine()> createEngine;
"""
    new_create_engine = f"""    std::function<cmaj::Engine()> createEngine;

    // {CMAJOR_EXTERNAL_FUNCTION_PROVIDER_PATCH_MARKER}
    // Optional native resolver used by JIT hosts for declared Cmajor external functions.
    cmaj::Engine::ExternalFunctionProviderFn externalFunctionProvider;
"""
    old_engine_load = """        if (engine.load (errors, program,
                         shouldResolveExternals ? manifest.createExternalResolverFunction()
                                                : [] (const cmaj::ExternalVariable&) -> choc::value::Value { return {}; },
                         {}))
"""
    new_engine_load = """        if (engine.load (errors, program,
                         shouldResolveExternals ? manifest.createExternalResolverFunction()
                                                : [] (const cmaj::ExternalVariable&) -> choc::value::Value { return {}; },
                         patch.externalFunctionProvider))
"""

    patched_text = _replace_unique_anchor(
        header_text,
        old_create_engine,
        new_create_engine,
        label="Cmajor Patch external-function provider member",
        path=patch_header,
    )
    patched_text = _replace_unique_anchor(
        patched_text,
        old_engine_load,
        new_engine_load,
        label="Cmajor Patch external-function provider forwarding",
        path=patch_header,
    )
    patch_header.write_text(patched_text, encoding="utf-8")

    if not _runtime_contains_external_function_provider_patch(runtime_root):
        raise RuntimeError(f"Cmajor external-function provider patch marker was not written to {patch_header}.")


def _runtime_contains_required_cmajor_sidechain_patch(runtime_root: Path) -> bool:
    juce_plugin_header = runtime_root / "include" / "cmajor" / "helpers" / "cmaj_JUCEPlugin.h"

    if not juce_plugin_header.exists():
        return False

    return CMAJOR_JUCE_SIDECHAIN_PATCH_MARKER in juce_plugin_header.read_text(encoding="utf-8")


def _apply_cmajor_sidechain_bus_patch(runtime_root: Path) -> None:
    juce_plugin_header = runtime_root / "include" / "cmajor" / "helpers" / "cmaj_JUCEPlugin.h"

    if not juce_plugin_header.exists():
        raise RuntimeError(f"Cmajor JUCE plugin helper not found: {juce_plugin_header}")

    header_text = juce_plugin_header.read_text(encoding="utf-8")

    if CMAJOR_JUCE_SIDECHAIN_PATCH_MARKER in header_text:
        return

    old_is_layout_ok = """    static bool isLayoutOK (const juce::Array<BusProperties>& patchLayouts,
                            const juce::Array<juce::AudioChannelSet>& suggestedLayouts)
    {
        if (patchLayouts.isEmpty())
            return suggestedLayouts.isEmpty() || suggestedLayouts.getReference(0).size() == 0;

        for (int i = 0; i < juce::jmin (patchLayouts.size(), suggestedLayouts.size()); ++i)
            if (patchLayouts.getReference(i).defaultLayout.size() != suggestedLayouts.getReference(i).size())
                return false;

        return true;
    }
"""
    new_is_layout_ok = f"""    // {CMAJOR_JUCE_SIDECHAIN_PATCH_MARKER}
    static bool isLayoutOK (const juce::Array<BusProperties>& patchLayouts,
                            const juce::Array<juce::AudioChannelSet>& suggestedLayouts,
                            bool isInput)
    {{
        if (patchLayouts.isEmpty())
            return suggestedLayouts.isEmpty() || suggestedLayouts.getReference(0).size() == 0;

        if (suggestedLayouts.size() < patchLayouts.size())
            return false;

        for (int i = 0; i < patchLayouts.size(); ++i)
        {{
            const auto expectedChannels = patchLayouts.getReference(i).defaultLayout.size();
            const auto suggestedChannels = suggestedLayouts.getReference(i).size();

            if (suggestedChannels == expectedChannels)
                continue;

            if (isInput && i > 0 && suggestedChannels == 0)
                continue;

            return false;
        }}

        return true;
    }}
"""
    old_is_buses_layout_supported = """        return isLayoutOK (patchBuses.inputLayouts, layout.inputBuses)
            && isLayoutOK (patchBuses.outputLayouts, layout.outputBuses);
"""
    new_is_buses_layout_supported = """        return isLayoutOK (patchBuses.inputLayouts, layout.inputBuses, true)
            && isLayoutOK (patchBuses.outputLayouts, layout.outputBuses, false);
"""
    old_get_playback_params = """    Patch::PlaybackParams getPlaybackParams (double rate, uint32_t requestedBlockSize)
    {
        auto layout = getBusesLayout();

        return Patch::PlaybackParams (rate, requestedBlockSize,
                                      static_cast<choc::buffer::ChannelCount> (layout.getMainInputChannels()),
                                      static_cast<choc::buffer::ChannelCount> (layout.getMainOutputChannels()));
    }
"""
    new_get_playback_params = """    static int countAudioChannels (const juce::Array<juce::AudioChannelSet>& buses)
    {
        int channels = 0;

        for (const auto& bus : buses)
            channels += bus.size();

        return channels;
    }

    Patch::PlaybackParams getPlaybackParams (double rate, uint32_t requestedBlockSize)
    {
        auto layout = getBusesLayout();

        return Patch::PlaybackParams (rate, requestedBlockSize,
                                      static_cast<choc::buffer::ChannelCount> (countAudioChannels (layout.inputBuses)),
                                      static_cast<choc::buffer::ChannelCount> (countAudioChannels (layout.outputBuses)));
    }
"""
    old_get_buses_properties = """    static BusesProperties getBusesProperties (const EndpointDetailsList& inputs,
                                               const EndpointDetailsList& outputs)
    {
        BusesProperties layout;

        uint32_t inputChannelCount = 0, outputChannelCount = 0;

        for (auto& input : inputs)
            inputChannelCount += input.getNumAudioChannels();

        for (auto& output : outputs)
            outputChannelCount += output.getNumAudioChannels();

        if (inputChannelCount > 0)
            layout.addBus (true, "in", juce::AudioChannelSet::canonicalChannelSet ((int) inputChannelCount), true);

        if (outputChannelCount > 0)
            layout.addBus (false, "out", juce::AudioChannelSet::canonicalChannelSet ((int) outputChannelCount), true);

        return layout;
    }
"""
    new_get_buses_properties = """    static std::string getEndpointBusName (const EndpointDetails& endpoint, std::string_view fallbackName)
    {
        if (auto annotationName = endpoint.annotation["name"].toString(); ! annotationName.empty())
            return annotationName;

        if (auto endpointName = endpoint.endpointID.toString(); ! endpointName.empty())
            return endpointName;

        return std::string (fallbackName);
    }

    static void addInputEndpointBuses (BusesProperties& layout, const EndpointDetailsList& inputs)
    {
        int audioBusIndex = 0;

        for (auto& input : inputs)
        {
            if (auto channelCount = input.getNumAudioChannels())
            {
                const auto fallbackName = audioBusIndex == 0 ? "Input" : "Sidechain";
                layout.addBus (true,
                               juce::String (getEndpointBusName (input, fallbackName)),
                               juce::AudioChannelSet::canonicalChannelSet ((int) channelCount),
                               audioBusIndex == 0);
                ++audioBusIndex;
            }
        }
    }

    static BusesProperties getBusesProperties (const EndpointDetailsList& inputs,
                                               const EndpointDetailsList& outputs)
    {
        BusesProperties layout;

        addInputEndpointBuses (layout, inputs);

        uint32_t outputChannelCount = 0;

        for (auto& output : outputs)
            outputChannelCount += output.getNumAudioChannels();

        if (outputChannelCount > 0)
            layout.addBus (false, "out", juce::AudioChannelSet::canonicalChannelSet ((int) outputChannelCount), true);

        return layout;
    }
"""
    replacements = (
        (old_is_layout_ok, new_is_layout_ok, "isLayoutOK"),
        (old_is_buses_layout_supported, new_is_buses_layout_supported, "isBusesLayoutSupported"),
        (old_get_playback_params, new_get_playback_params, "getPlaybackParams"),
        (old_get_buses_properties, new_get_buses_properties, "getBusesProperties"),
    )

    patched_text = header_text

    for old, new, label in replacements:
        patched_text = _replace_unique_anchor(
            patched_text,
            old,
            new,
            label=f"Cmajor sidechain bus {label} patch",
            path=juce_plugin_header,
        )

    juce_plugin_header.write_text(patched_text, encoding="utf-8")

    if not _runtime_contains_required_cmajor_sidechain_patch(runtime_root):
        raise RuntimeError(f"Cmajor sidechain bus patch marker was not written to {juce_plugin_header}.")


def _runtime_head(runtime_root: Path) -> str | None:
    if not (runtime_root / ".git").exists():
        return None

    try:
        return _run(["git", "rev-parse", "HEAD"], cwd=runtime_root, capture=True).stdout.strip()
    except subprocess.CalledProcessError:
        return None


def _prepare_runtime_submodules(runtime_root: Path) -> None:
    _run(
        [
            "git",
            "-c",
            "url.https://github.com/.insteadof=git@github.com:",
            "submodule",
            "update",
            "--init",
            "--depth",
            "1",
        ],
        cwd=runtime_root,
    )

    choc_root = runtime_root / "include" / "choc"

    _run(["git", "remote", "set-url", "origin", PATCHED_CHOC_GIT_URL], cwd=choc_root)
    _run(["git", "fetch", "--depth", "1", "origin", PATCHED_CHOC_BRANCH], cwd=choc_root)
    _run(["git", "checkout", "--detach", PATCHED_CHOC_COMMIT], cwd=choc_root)
    _apply_cosimo_choc_keyboard_relay_patch(runtime_root)
    _apply_choc_quickjs_pending_job_patch(runtime_root)
    _apply_choc_timer_clear_timeout_patch(runtime_root)
    _apply_cmajor_patch_worker_queue_patch(runtime_root)
    _apply_cmajor_patch_worker_lifetime_patch(runtime_root)
    _apply_cmajor_patch_worker_nonfatal_error_patch(runtime_root)
    _apply_cmajor_stored_state_string_comparison_patch(runtime_root)
    _apply_cmajor_quickjs_resource_bridge_patch(runtime_root)
    _apply_cmajor_external_function_provider_patch(runtime_root)


def _clone_runtime(destination: Path) -> None:
    temp_destination = destination.with_name(f"{destination.name}.tmp")

    if temp_destination.exists():
        shutil.rmtree(temp_destination)

    destination.parent.mkdir(parents=True, exist_ok=True)

    _run(
        [
            "git",
            "clone",
            "--depth",
            "1",
            "--branch",
            RUNTIME_TAG,
            RUNTIME_GIT_URL,
            str(temp_destination),
        ]
    )

    _prepare_runtime_submodules(temp_destination)
    _apply_cosimo_choc_keyboard_relay_patch(temp_destination)
    _apply_choc_quickjs_pending_job_patch(temp_destination)
    _apply_choc_timer_clear_timeout_patch(temp_destination)
    _apply_cmajor_patch_worker_queue_patch(temp_destination)
    _apply_cmajor_patch_worker_lifetime_patch(temp_destination)
    _apply_cmajor_patch_worker_nonfatal_error_patch(temp_destination)
    _apply_cmajor_stored_state_string_comparison_patch(temp_destination)
    _apply_cmajor_quickjs_resource_bridge_patch(temp_destination)
    _apply_cmajor_external_function_provider_patch(temp_destination)

    fetched_head = _runtime_head(temp_destination)

    if fetched_head != RUNTIME_COMMIT:
        raise RuntimeError(
            f"Fetched Cmajor runtime commit {fetched_head or '<missing>'}, expected {RUNTIME_COMMIT} for tag {RUNTIME_TAG}."
        )

    fetched_choc_head = _choc_head(temp_destination)

    if fetched_choc_head != PATCHED_CHOC_COMMIT:
        raise RuntimeError(
            f"Fetched CHOC commit {fetched_choc_head or '<missing>'}, expected {PATCHED_CHOC_COMMIT}."
        )

    if not _runtime_contains_required_choc_patches(temp_destination):
        raise RuntimeError(
            "Fetched CHOC checkout does not contain the required WebView patch markers."
        )

    if not _runtime_contains_quickjs_pending_job_patch(temp_destination):
        raise RuntimeError(
            "Fetched CHOC checkout does not contain the required QuickJS pending-job patch."
        )

    if not _runtime_contains_timer_clear_timeout_patch(temp_destination):
        raise RuntimeError(
            "Fetched CHOC checkout does not contain the required timer clearTimeout patch."
        )

    if not _runtime_contains_patch_worker_queue_patch(temp_destination):
        raise RuntimeError(
            "Fetched Cmajor checkout does not contain the required patch-worker queue patch."
        )

    if not _runtime_contains_patch_worker_lifetime_patch(temp_destination):
        raise RuntimeError(
            "Fetched Cmajor checkout does not contain the required patch-worker lifetime patch."
        )

    if not _runtime_contains_patch_worker_nonfatal_error_patch(temp_destination):
        raise RuntimeError(
            "Fetched Cmajor checkout does not contain the required nonfatal patch-worker error policy."
        )

    if not _runtime_contains_stored_state_string_comparison_patch(temp_destination):
        raise RuntimeError(
            "Fetched Cmajor checkout does not contain the required stored-state string comparison patch."
        )

    if not _runtime_contains_quickjs_resource_bridge_patch(temp_destination):
        raise RuntimeError(
            "Fetched Cmajor checkout does not contain the required QuickJS resource-bridge patch."
        )

    if not _runtime_contains_external_function_provider_patch(temp_destination):
        raise RuntimeError(
            "Fetched Cmajor checkout does not contain the required external-function provider patch."
        )

    if destination.exists():
        shutil.rmtree(destination)

    temp_destination.rename(destination)


def ensure_runtime() -> Path:
    current_head = _runtime_head(RUNTIME_DESTINATION)
    current_choc_head = _choc_head(RUNTIME_DESTINATION)

    if (
        current_head == RUNTIME_COMMIT
        and current_choc_head == PATCHED_CHOC_COMMIT
        and _runtime_looks_complete(RUNTIME_DESTINATION)
    ):
        _apply_cosimo_choc_keyboard_relay_patch(RUNTIME_DESTINATION)
        _apply_choc_quickjs_pending_job_patch(RUNTIME_DESTINATION)
        _apply_choc_timer_clear_timeout_patch(RUNTIME_DESTINATION)
        _apply_cmajor_patch_worker_queue_patch(RUNTIME_DESTINATION)
        _apply_cmajor_patch_worker_lifetime_patch(RUNTIME_DESTINATION)
        _apply_cmajor_patch_worker_nonfatal_error_patch(RUNTIME_DESTINATION)
        _apply_cmajor_stored_state_string_comparison_patch(RUNTIME_DESTINATION)
        _apply_cmajor_quickjs_resource_bridge_patch(RUNTIME_DESTINATION)
        _apply_cmajor_external_function_provider_patch(RUNTIME_DESTINATION)
        _apply_cmajor_sidechain_bus_patch(RUNTIME_DESTINATION)

        if (
            _runtime_contains_required_choc_patches(RUNTIME_DESTINATION)
            and _runtime_contains_quickjs_pending_job_patch(RUNTIME_DESTINATION)
            and _runtime_contains_timer_clear_timeout_patch(RUNTIME_DESTINATION)
            and _runtime_contains_patch_worker_queue_patch(RUNTIME_DESTINATION)
            and _runtime_contains_patch_worker_lifetime_patch(RUNTIME_DESTINATION)
            and _runtime_contains_patch_worker_nonfatal_error_patch(RUNTIME_DESTINATION)
            and _runtime_contains_stored_state_string_comparison_patch(RUNTIME_DESTINATION)
            and _runtime_contains_quickjs_resource_bridge_patch(RUNTIME_DESTINATION)
            and _runtime_contains_external_function_provider_patch(RUNTIME_DESTINATION)
            and _runtime_contains_required_cmajor_sidechain_patch(RUNTIME_DESTINATION)
        ):
            return RUNTIME_DESTINATION

    if current_head == RUNTIME_COMMIT:
        _prepare_runtime_submodules(RUNTIME_DESTINATION)

        current_head = _runtime_head(RUNTIME_DESTINATION)
        current_choc_head = _choc_head(RUNTIME_DESTINATION)

        if (
            current_head == RUNTIME_COMMIT
            and current_choc_head == PATCHED_CHOC_COMMIT
            and _runtime_contains_required_choc_patches(RUNTIME_DESTINATION)
            and _runtime_contains_quickjs_pending_job_patch(RUNTIME_DESTINATION)
            and _runtime_contains_timer_clear_timeout_patch(RUNTIME_DESTINATION)
            and _runtime_contains_patch_worker_queue_patch(RUNTIME_DESTINATION)
            and _runtime_contains_patch_worker_lifetime_patch(RUNTIME_DESTINATION)
            and _runtime_contains_patch_worker_nonfatal_error_patch(RUNTIME_DESTINATION)
            and _runtime_contains_stored_state_string_comparison_patch(RUNTIME_DESTINATION)
            and _runtime_contains_quickjs_resource_bridge_patch(RUNTIME_DESTINATION)
            and _runtime_contains_external_function_provider_patch(RUNTIME_DESTINATION)
            and _runtime_looks_complete(RUNTIME_DESTINATION)
        ):
            _apply_cmajor_sidechain_bus_patch(RUNTIME_DESTINATION)
            return RUNTIME_DESTINATION

    if RUNTIME_DESTINATION.exists():
        shutil.rmtree(RUNTIME_DESTINATION)

    _clone_runtime(RUNTIME_DESTINATION)

    current_head = _runtime_head(RUNTIME_DESTINATION)
    current_choc_head = _choc_head(RUNTIME_DESTINATION)

    if current_head != RUNTIME_COMMIT:
        raise RuntimeError(
            f"Pinned Cmajor runtime fetch completed, but {RUNTIME_DESTINATION} resolved to {current_head or '<missing>'} instead of {RUNTIME_COMMIT}."
        )

    if current_choc_head != PATCHED_CHOC_COMMIT:
        raise RuntimeError(
            f"Patched CHOC fetch completed, but {RUNTIME_DESTINATION / 'include/choc'} resolved to {current_choc_head or '<missing>'} instead of {PATCHED_CHOC_COMMIT}."
        )

    if not _runtime_contains_required_choc_patches(RUNTIME_DESTINATION):
        raise RuntimeError(
            f"Patched CHOC checkout is missing required WebView patch markers in {RUNTIME_DESTINATION / 'include/choc/choc/gui/choc_WebView.h'}."
        )

    if not _runtime_contains_quickjs_pending_job_patch(RUNTIME_DESTINATION):
        raise RuntimeError(
            f"Patched CHOC checkout is missing the QuickJS pending-job patch in {RUNTIME_DESTINATION / 'include/choc/choc/javascript/choc_javascript_QuickJS.h'}."
        )

    if not _runtime_contains_timer_clear_timeout_patch(RUNTIME_DESTINATION):
        raise RuntimeError(
            f"Patched CHOC checkout is missing the timer clearTimeout patch in {RUNTIME_DESTINATION / 'include/choc/choc/javascript/choc_javascript_Timer.h'}."
        )

    if not _runtime_contains_patch_worker_queue_patch(RUNTIME_DESTINATION):
        raise RuntimeError(
            f"Pinned Cmajor checkout is missing the patch-worker queue patch in {RUNTIME_DESTINATION / 'include/cmajor/helpers/cmaj_Patch.h'}."
        )

    if not _runtime_contains_patch_worker_lifetime_patch(RUNTIME_DESTINATION):
        raise RuntimeError(
            f"Pinned Cmajor checkout is missing the patch-worker lifetime patch in {RUNTIME_DESTINATION / 'include/cmajor/helpers/cmaj_Patch.h'}."
        )

    if not _runtime_contains_patch_worker_nonfatal_error_patch(RUNTIME_DESTINATION):
        raise RuntimeError(
            f"Pinned Cmajor checkout is missing the nonfatal patch-worker error policy in {RUNTIME_DESTINATION / 'include/cmajor/helpers/cmaj_Patch.h'}."
        )

    if not _runtime_contains_stored_state_string_comparison_patch(RUNTIME_DESTINATION):
        raise RuntimeError(
            f"Pinned Cmajor checkout is missing the stored-state string comparison patch in {RUNTIME_DESTINATION / 'include/cmajor/helpers/cmaj_Patch.h'}."
        )

    if not _runtime_contains_quickjs_resource_bridge_patch(RUNTIME_DESTINATION):
        raise RuntimeError(
            f"Pinned Cmajor checkout is missing the QuickJS resource-bridge patch in {RUNTIME_DESTINATION / 'include/cmajor/helpers/cmaj_PatchWorker_QuickJS.h'}."
        )

    if not _runtime_contains_external_function_provider_patch(RUNTIME_DESTINATION):
        raise RuntimeError(
            f"Pinned Cmajor checkout is missing the external-function provider patch in {RUNTIME_DESTINATION / 'include/cmajor/helpers/cmaj_Patch.h'}."
        )

    _apply_cmajor_sidechain_bus_patch(RUNTIME_DESTINATION)

    return RUNTIME_DESTINATION


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fetch the pinned Cmajor runtime with patched CHOC into build/deps and print its path."
    )
    parser.add_argument(
        "--path",
        action="store_true",
        help="Ensure the pinned runtime exists and print its absolute path.",
    )
    args = parser.parse_args()

    if not args.path:
        parser.error("Pass --path to print the pinned runtime location.")

    runtime_root = ensure_runtime()
    print(runtime_root)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, subprocess.CalledProcessError) as error:
        print(f"Failed to prepare the pinned Cmajor runtime: {error}", file=sys.stderr)
        raise SystemExit(1)
