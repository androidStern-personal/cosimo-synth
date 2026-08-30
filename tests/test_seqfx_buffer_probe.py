from reference_labs.seqfx_buffers.probe import (
    RATE_PROBES,
    candidates,
    patch_manifest,
    render_cmajor_source,
    validate_model,
)


def test_buffer_candidate_memory_model_and_selection_budget() -> None:
    validate_model()
    by_name = {candidate.name: candidate for candidate in candidates()}

    assert by_name["current-separated"].byte_count < by_name["tiered-hybrid"].byte_count
    assert by_name["tiered-hybrid"].byte_count < by_name["fixed-48k-packed"].byte_count
    assert by_name["fixed-48k-packed"].byte_count < by_name["fixed-48k-float"].byte_count
    assert by_name["fixed-48k-float"].byte_count < by_name["naive-host-rate"].byte_count


def test_generated_probe_touches_every_allocation_and_has_named_buses() -> None:
    for candidate in candidates():
        source = render_cmajor_source(candidate)
        assert 'audioIn [[ name: "Input" ]]' in source
        assert 'audioOut [[ name: "Output" ]]' in source
        for allocation in candidate.allocations:
            if allocation.split_copies:
                for copy_index in range(allocation.copies):
                    field_name = f"{allocation.name}{copy_index}"
                    assert f"] {field_name};" in source
                    assert f"{field_name}[{field_name}Index]" in source
            else:
                assert f"] {allocation.name};" in source
                assert f"{allocation.name}[0, {allocation.name}Index]" in source


def test_probe_manifest_and_supported_rate_matrix_are_stable() -> None:
    assert '"source": [\n    "Probe.cmajor"\n  ]' in patch_manifest()
    assert RATE_PROBES == (44_100, 48_000, 88_200, 96_000, 192_000)
