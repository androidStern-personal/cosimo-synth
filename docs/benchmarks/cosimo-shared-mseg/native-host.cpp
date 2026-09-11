#include <map>

#include <algorithm>
#include <chrono>
#include <cmath>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <vector>
#define CMAJOR_DLL 1
#include "cmajor/API/cmaj_Engine.h"
#include "cmajor/helpers/cmaj_EndpointTypeCoercion.h"
#include "RendererExternalFunctionProvider.h"
#ifdef COSIMO_BENCH_AOT
cmaj::Engine makeBaselineAot();
#endif
void benchmarkRead(int,const void*,size_t) {}
using Clock=std::chrono::steady_clock;using Value=choc::value::Value;
std::string read(const std::string& path){std::ifstream in(path,std::ios::binary);return {std::istreambuf_iterator<char>(in),{}};}
double us(Clock::time_point t){return std::chrono::duration<double,std::micro>(Clock::now()-t).count();}
int main(int argc,char**argv){try{
 if(argc!=7)throw std::runtime_error("library manifest fixtures output before/after voices");
 const std::string mode=argv[5],fixtures=argv[3],output=argv[4];const int voices=std::stoi(argv[6]);
 if(!cmaj::Library::initialise(argv[1]))throw std::runtime_error("library");
#ifdef COSIMO_BENCH_AOT
 auto engine=makeBaselineAot();
#else
 auto engine=cmaj::Engine::create();
#endif
 const auto manifest=choc::json::parse(read(argv[2]));cmaj::Program program;cmaj::DiagnosticMessageList errors;
 for(auto file:manifest["source"]){auto name=(std::filesystem::path(argv[2]).parent_path()/file.toString()).string();if(!program.parse(errors,name,read(name)))throw std::runtime_error(errors.toString());}
 engine.setBuildSettings(cmaj::BuildSettings().setFrequency(48000).setMaxBlockSize(128).setSessionID(13579));
 if(!engine.load(errors,program,{},cosimo::three_osc::bridge::createExternalFunctionProvider()))throw std::runtime_error(errors.toString());
 cmaj::EndpointTypeCoercionHelperList coercion;coercion.initialise(engine,128,true,true);
 std::map<std::string,cmaj::EndpointHandle> handles;for(auto e:engine.getInputEndpoints())handles[e.endpointID.toString()]=engine.getEndpointHandle(e.endpointID.toString().c_str());
 auto audioHandle=engine.getEndpointHandle("audioOut");if(!engine.link(errors,{}))throw std::runtime_error(errors.toString());auto performer=engine.createPerformer();coercion.initialiseDictionary(performer);
 cmaj::PatchSharedData shared(mode=="before"?3:9,52572624);int serial=0;std::vector<float> audio;std::array<float,256> blockAudio{};
 auto submit=[&](int input,std::shared_ptr<std::vector<int32_t>> bytes){auto request=shared.store.beginRequest(input,1);if(shared.store.submitBytes(request.ticket,std::move(bytes))!=cmaj::SharedDataStore::SubmitResult::accepted)throw std::runtime_error("shared rejected");};
 for(int input=0;input<3;input++){auto bytes=read(fixtures+"/table"+std::to_string(input)+".bin");auto data=std::make_shared<std::vector<int32_t>>(bytes.size()/4);memcpy(data->data(),bytes.data(),bytes.size());submit(input,data);}
 auto advance=[&](bool capture=false){shared.store.beginBlock();{cmaj::PatchSharedData::ReadScope scope(&shared);performer.setBlockSize(128);performer.advance();if(capture){performer.copyOutputFrames(audioHandle,blockAudio.data(),128);audio.insert(audio.end(),blockAudio.begin(),blockAudio.end());}}shared.store.endBlock();shared.store.drain();};
 auto send=[&](std::string name,Value value,bool lane=true){if(lane){value.addMember("dspSessionId",13579);value.addMember("deliverySerial",++serial);}auto data=coercion.coerceValueToMatchingType(handles.at(name),value,cmaj::EndpointType::event);if(!data)throw std::runtime_error("event coercion "+name);performer.addInputEvent(handles.at(name),data.typeIndex,data.data.data);};
 auto parameter=[&](std::string name,float value){performer.setInputValue(handles.at(name),value,0);};
 const auto data=choc::json::parse(read(fixtures+"/data.json"));advance();
 auto upload=[&](int shape,int edit){auto start=Clock::now();auto curve=data["curves"][edit][shape];if(mode=="before")send("modulationMsegBuffer",choc::json::create("slot",1,"shapeIndex",shape,"buffer",curve));else{auto packed=std::make_shared<std::vector<int32_t>>(2055);auto* words=packed->data();words[0]=0x4d534547;words[1]=13579;words[2]=++serial;words[3]=2051;for(int i=0;i<2051;i++){float x=float(curve[i].getFloat64());memcpy(words+4+i,&x,4);}submit(3+shape,packed);}double delivery=us(start);start=Clock::now();advance();return std::array<double,2>{delivery,us(start)};};
 upload(0,0);upload(1,0);send("modulationMsegPlayback",Value(data["playback"]));advance();send("modulationProgram",Value(data["program"]));advance();parameter("mseg1Rate",.12f);
 for(int n=0;n<voices;n++)send("midiIn",choc::json::create("message",0x900064|((48+n*3)<<8)),false);
 for(int phase=0;phase<4;phase++){if(phase==1)parameter("mseg1Morph",.5f);if(phase==2){upload(0,45);parameter("mseg1Morph",1);}if(phase==3){auto play=Value(data["playback"]);play.setMember("loopStart",.3f);play.setMember("loopEnd",.6f);send("modulationMsegPlayback",play);advance();parameter("mseg1Morph",.25f);}for(int b=0;b<128;b++)advance(true);}
 for(int b=0;b<256;b++)advance();auto steady=choc::value::createEmptyArray();std::vector<double> sorted;
 for(int r=0;r<9;r++){auto t=Clock::now();for(int b=0;b<1024;b++)advance();auto value=us(t)/1024;sorted.push_back(value);steady.addArrayElement(value);}std::sort(sorted.begin(),sorted.end());
 auto edits=choc::value::createEmptyArray();for(int i=0;i<100;i++){auto e=upload(i%2,i%50);edits.addArrayElement(choc::json::create("deliveryUs",e[0],"adoptionUs",e[1]));}
 double sq=0,stereo=0;for(size_t i=0;i<audio.size();i++){if(!std::isfinite(audio[i]))throw std::runtime_error("nonfinite");sq+=double(audio[i])*audio[i];if(i%2==0)stereo+=std::abs(audio[i]-audio[i+1]);}auto rms=std::sqrt(sq/audio.size());
 auto result=choc::json::create("mode",mode,"voices",voices,"samples",int(audio.size()),"rms",rms,"stereoDifference",stereo,"medianBlockUs",sorted[4],"cpuPercent",sorted[4]/2666.6666667*100,"repetitionsUs",steady,"edits",edits);
 std::ofstream(output+".f32",std::ios::binary).write(reinterpret_cast<char*>(audio.data()),audio.size()*4);std::ofstream(output+".json")<<choc::json::toString(result,true);std::cout<<choc::json::toString(result,false)<<std::endl;
 if(rms<.001||stereo<.1)throw std::runtime_error("not audible");return 0;
}catch(const std::exception&e){std::cerr<<e.what()<<std::endl;return 1;}}
