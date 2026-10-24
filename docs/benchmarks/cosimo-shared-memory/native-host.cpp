#include <algorithm>
#include <array>
#include <atomic>
#include <chrono>
#include <cmath>
#include <future>
#include <fstream>
#include <cstdlib>
#include <iostream>
#include <map>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <thread>
#include <vector>
#include <sys/resource.h>
#define CMAJOR_DLL 1
#include "cmajor/helpers/cmaj_Patch.h"
void benchmarkSent(const choc::value::ValueView&);
void benchmarkReserved(int, uint64_t, const void*, size_t);
void benchmarkRead(int, const void*, size_t);
#include COSIMO_MEASURED_WORKER_HEADER
#include "choc/gui/choc_MessageLoop.h"
#include "RendererExternalFunctionProvider.h"

#ifdef COSIMO_BENCH_AOT
cmaj::Engine makeBaselineAot();
#endif
using Clock=std::chrono::steady_clock;
using V=choc::value::ValueView;
constexpr uint32_t frames=128;
constexpr double rate=48000;
double ms(Clock::time_point t){return std::chrono::duration<double,std::milli>(Clock::now()-t).count();}
template<typename Fn> auto onLoop(Fn fn){
 auto task=std::make_shared<std::packaged_task<std::invoke_result_t<Fn>()>>(std::move(fn)); auto result=task->get_future();
 choc::messageloop::postMessage([task]{(*task)();});
 if(result.wait_for(std::chrono::seconds(60))!=std::future_status::ready)throw std::runtime_error("message loop timeout");
 return result.get();
}
struct Counts {uint64_t messages=0, jsonBytes=0;};
struct Metrics {
 std::mutex mutex;
 std::map<std::string,Counts> sends;
 double jsonMeasurementMs=0;
 std::array<int,3> activeTable{{-1,-1,-1}};
 std::array<int,3> desiredTable{{-1,-1,-1}};
 Clock::time_point selected=Clock::now();
 double desiredToActiveMs=-1, desiredObservedToActiveMs=-1; Clock::time_point desiredObserved; bool sawDesired=false;
 int selectedIndex=-1;
 bool waiting=false;
 std::string error;
};
Metrics* measuredMetrics=nullptr;
std::atomic<uintptr_t> reservationAddresses[3]{}, readerAddresses[3]{};
std::atomic<uint64_t> reservationSizes[3]{}, readerSizes[3]{};
std::atomic<uint64_t> reservationCalls{0}, reservationBytes{0};
void benchmarkSent(const V& value){
 auto* metrics=measuredMetrics;if(!metrics)return;
 auto start=Clock::now();const auto json=choc::json::toString(value,false);
 auto name=value["type"].toString()+":"+value["id"].toString();
 std::lock_guard<std::mutex> lock(metrics->mutex);auto& count=metrics->sends[name];++count.messages;count.jsonBytes+=json.size();metrics->jsonMeasurementMs+=ms(start);
}
void benchmarkReserved(int input,uint64_t,const void* data,size_t size){if(input>=0&&input<3){reservationAddresses[input]=reinterpret_cast<uintptr_t>(data);reservationSizes[input]=size;}++reservationCalls;reservationBytes+=size;}
void benchmarkRead(int input,const void* data,size_t size){if(input>=0&&input<3&&data){readerAddresses[input]=reinterpret_cast<uintptr_t>(data);readerSizes[input]=size;}}
struct Audio {
 cmaj::Patch& patch; std::mutex gate,results;
 std::atomic<bool> active{false},stopped{false};
 std::vector<double> times; double sumSquares=0; uint64_t samples=0; uint64_t nonfinite=0;
 std::thread thread;
 explicit Audio(cmaj::Patch& p):patch(p){}
 void start(){thread=std::thread([this]{
  auto next=Clock::now();
  while(!stopped){
   std::array<float,frames> l{},r{}; float* channels[]{l.data(),r.data()}; bool ran=false; double duration=0;
   {std::lock_guard<std::mutex> lock(gate);if(active){auto begin=Clock::now();patch.process(channels,frames,[](uint32_t,choc::midi::MessageView){});duration=ms(begin)*1000;ran=true;}}
   if(ran){std::lock_guard<std::mutex> lock(results); times.push_back(duration); for(size_t i=0;i<frames;++i){sumSquares+=double(l[i])*l[i]+double(r[i])*r[i];nonfinite+=!std::isfinite(l[i])+!std::isfinite(r[i]);}samples+=frames*2;}
   next+=std::chrono::nanoseconds(2666667); std::this_thread::sleep_until(next);
   if(Clock::now()-next>std::chrono::milliseconds(100))next=Clock::now();
  }
 });}
 void stop(){stopped=true;if(thread.joinable())thread.join();}
 ~Audio(){stop();}
 void clear(){std::lock_guard<std::mutex> lock(results);times.clear();sumSquares=0;samples=0;nonfinite=0;}
 choc::value::Value summary(){std::lock_guard<std::mutex> lock(results);auto v=times;std::sort(v.begin(),v.end());auto q=[&](double p){return v.empty()?0:v[std::min(v.size()-1,size_t(p*v.size()))];};return choc::json::create("blocks",int64_t(v.size()),"medianUs",q(.5),"p95Us",q(.95),"p99Us",q(.99),"maxUs",q(1),"overBudgetBlocks",int64_t(std::count_if(v.begin(),v.end(),[](double t){return t>frames/rate*1e6;})),"rms",samples?std::sqrt(sumSquares/samples):0,"nonfinite",int64_t(nonfinite));}
};
bool waitFor(Metrics& m,const std::function<bool()>& pred,int seconds=45){auto limit=Clock::now()+std::chrono::seconds(seconds);while(Clock::now()<limit){{std::lock_guard<std::mutex> lock(m.mutex);if(!m.error.empty())throw std::runtime_error(m.error);if(pred())return true;}std::this_thread::sleep_for(std::chrono::milliseconds(5));}return false;}
int run(const char* library,const char* manifestPath,int index){
 if(!cmaj::Library::initialise(library))throw std::runtime_error("Cmajor library unavailable");
 Metrics metrics; cmaj::Patch patch; Audio audio(patch);
 #ifdef COSIMO_BENCH_AOT
 patch.createEngine=[] {return makeBaselineAot();};
#else
 patch.createEngine=[] {return cmaj::Engine::create();};
#endif
 patch.externalFunctionProvider=cosimo::three_osc::bridge::createExternalFunctionProvider();
 measuredMetrics=&metrics;cmaj::enableMeasuredQuickJSPatchWorker(patch);
 patch.startPlayback=[&]{audio.active=true;};
 patch.stopPlayback=[&]{audio.active=false;std::lock_guard<std::mutex> lock(audio.gate);};
 std::atomic<uint64_t> xruns{0};patch.handleXrun=[&]{++xruns;};
 patch.statusChanged=[&](const cmaj::Patch::Status& status){if(status.messageList.hasErrors()){std::lock_guard<std::mutex> lock(metrics.mutex);metrics.error=status.messageList.toString();}};
 patch.handleOutputEvent=[&](uint64_t,std::string_view endpoint,const V& value){if(endpoint!="runtimeState")return;std::lock_guard<std::mutex> lock(metrics.mutex);int osc=value["oscillatorIndex"].getWithDefault<int>(0);if(osc<0||osc>=3)return;metrics.desiredTable[osc]=value["desiredTableIndex"].getWithDefault<int>(-1);if(value["hasActive"].getWithDefault<int>(0)!=0)metrics.activeTable[osc]=value["activeTableIndex"].getWithDefault<int>(-1);if(osc==0&&metrics.waiting&&!metrics.sawDesired&&metrics.desiredTable[0]==metrics.selectedIndex){metrics.desiredObserved=Clock::now();metrics.sawDesired=true;}if(osc==0&&metrics.waiting&&metrics.activeTable[0]==metrics.selectedIndex){metrics.desiredToActiveMs=ms(metrics.selected);metrics.desiredObservedToActiveMs=metrics.sawDesired?ms(metrics.desiredObserved):-1;metrics.waiting=false;}};
 cmaj::PatchManifest manifest;manifest.initialiseWithFile(manifestPath);cmaj::Patch::LoadParams params;params.manifest=manifest;patch.setPlaybackParams({rate,frames,0,2});
 auto compileStart=Clock::now();if(!patch.loadPatch(params,true)||!patch.isPlayable())throw std::runtime_error("full Cosimo patch load failed");double compileMs=ms(compileStart);
 std::cerr<<"BASELINE playable compileMs="<<compileMs<<std::endl;audio.start();
 bool boot=waitFor(metrics,[&]{return metrics.activeTable[0]>=0&&metrics.activeTable[1]>=0&&metrics.activeTable[2]>=0;});
 if(!boot){audio.stop();onLoop([&]{patch.unload();});throw std::runtime_error("factory table boot timed out");}
 onLoop([&]{patch.sendMIDIInputEvent(cmaj::EndpointID::create(std::string_view{"midiIn"}),choc::midi::ShortMessage(0x90,60,100),2000);});
 std::this_thread::sleep_for(std::chrono::milliseconds(250));
 {std::lock_guard<std::mutex> lock(metrics.mutex);metrics.sends.clear();metrics.jsonMeasurementMs=0;metrics.selected=Clock::now();metrics.selectedIndex=index;metrics.waiting=true;}
 audio.clear();xruns=0;reservationCalls=0;reservationBytes=0;
 bool sent=onLoop([&]{return patch.sendEventOrValueToPatch(cmaj::EndpointID::create(std::string_view{"oscAWavetableSelect"}),choc::value::Value(float(index)),0,2000);});
 bool applied=sent&&waitFor(metrics,[&]{return !metrics.waiting;});
 auto callback=audio.summary();
 std::this_thread::sleep_for(std::chrono::milliseconds(250));audio.stop();
 // Stop the paced producer before deterministic offline settling/capture.
 onLoop([&]{patch.sendMIDIInputEvent(cmaj::EndpointID::create(std::string_view{"midiIn"}),choc::midi::ShortMessage(0x80,60,0),2000);});
 auto render=[&](std::vector<float>* out){std::array<float,frames> l{},r{};float* channels[]{l.data(),r.data()};patch.process(channels,frames,[](uint32_t,choc::midi::MessageView){});if(out)for(size_t i=0;i<frames;++i){out->push_back(l[i]);out->push_back(r[i]);}};
 for(int block=0;block<750;++block)render(nullptr); // 2 seconds at48k, no paced callback metric includes this.
 onLoop([&]{patch.sendMIDIInputEvent(cmaj::EndpointID::create(std::string_view{"midiIn"}),choc::midi::ShortMessage(0x90,60,100),2000);});
 std::vector<float> steady;steady.reserve(32768);for(int block=0;block<128;++block)render(&steady);
 double steadySquares=0;for(auto x:steady)steadySquares+=double(x)*x;
 const auto audioFile=std::getenv("COSIMO_BENCH_AUDIO");if(audioFile){std::ofstream output(audioFile,std::ios::binary);output.write(reinterpret_cast<const char*>(steady.data()),steady.size()*sizeof(float));}
 auto pointers=choc::value::createEmptyArray();for(int i=0;i<3;++i)pointers.addArrayElement(choc::json::create("input",i,"reservedAddress",int64_t(reservationAddresses[i].load()),"readerAddress",int64_t(readerAddresses[i].load()),"reservedBytes",int64_t(reservationSizes[i].load()),"readerBytes",int64_t(readerSizes[i].load()),"sameAllocation",reservationAddresses[i]!=0&&reservationAddresses[i]==readerAddresses[i]));
 choc::value::Value counts=choc::value::createObject("");double elapsed,jsonMs;int active;
 {std::lock_guard<std::mutex> lock(metrics.mutex);for(auto& [key,count]:metrics.sends)counts.addMember(key,choc::json::create("messages",int64_t(count.messages),"jsonBytes",int64_t(count.jsonBytes)));elapsed=metrics.desiredToActiveMs;jsonMs=metrics.jsonMeasurementMs;active=metrics.activeTable[0];}
 rusage usage{};getrusage(RUSAGE_SELF,&usage);
 auto mode=
#ifdef COSIMO_BENCH_AOT
 "aot-paced";
#else
 "jit-paced";
#endif
 auto output=choc::json::create("mode",mode,"sampleRate",rate,"blockSize",int(frames),"tableIndex",index,"activeTableIndex",active,"applied",applied,"compileMs",compileMs,"selectionCallToObservedActiveMs",elapsed,"desiredObservedToActiveMs",metrics.desiredObservedToActiveMs,"audioDuringLoad",callback,"workerMessages",counts,"jsonInstrumentationMs",jsonMs,"inputPushFailures",int64_t(xruns.load()),"processPeakRSSBytes",int64_t(usage.ru_maxrss),"steadyRms",std::sqrt(steadySquares/steady.size()),"steadyAudioFile",audioFile?audioFile:"not requested","sharedReservations",int64_t(reservationCalls.load()),"sharedReservationBytes",int64_t(reservationBytes.load()),"sharedPointers",pointers,"prepMemory","unavailable: peakRSS is entire process, not JS preparation");
 std::cout<<"RESULT "<<choc::json::toString(output,false)<<std::endl;
 onLoop([&]{patch.unload();});return applied?0:1;
}
int main(int argc,char** argv){if(argc!=4)return 2;choc::messageloop::initialise();std::atomic<int> result{1};std::thread task([&]{try{result=run(argv[1],argv[2],std::stoi(argv[3]));}catch(const std::exception& e){std::cerr<<"BENCHMARK FAILED "<<e.what()<<std::endl;}choc::messageloop::stop();});choc::messageloop::run();task.join();return result;}
