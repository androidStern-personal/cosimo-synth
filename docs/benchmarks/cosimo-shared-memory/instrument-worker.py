from pathlib import Path
import sys
source=Path(sys.argv[1]); out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
p=source/'include/cmajor/helpers/cmaj_PatchWorker_QuickJS.h';s=p.read_text()
s=s.replace('#include "cmaj_Patch.h"',f'#include "{source}/include/cmajor/helpers/cmaj_Patch.h"')
s=s.replace('"../../choc/',f'"{source}/include/choc/')
s=s.replace('enableQuickJSPatchWorker (Patch& p)','enableMeasuredQuickJSPatchWorker (Patch& p)')
s=s.replace('send (*message);','{ ::benchmarkSent (*message); send (*message); }')
s=s.replace('auto reservation = patch.reserveSharedData (*this, static_cast<uint32_t> (input), static_cast<size_t> (length));', 'auto reservation = patch.reserveSharedData (*this, static_cast<uint32_t> (input), static_cast<size_t> (length)); ::benchmarkReserved(static_cast<int>(input), reservation.id, reservation.bytes->data(), static_cast<size_t>(length));')
(out/'MeasuredWorker.h').write_text(s)
