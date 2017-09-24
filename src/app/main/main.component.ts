import { Component, OnInit, ElementRef } from '@angular/core';
import { Http, Response, RequestOptions, Headers } from '@angular/http';
import * as RecordRTC from 'recordrtc';
import 'rxjs/add/operator/map';
import { VideoAnalysis } from '../common/cognitive-api/video-analysis';
import { ImageAnalysis } from '../common/cognitive-api/image-analysis';
import { CognitiveApiService } from '../common/cognitive-api/cognitive-api.service'

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})

export class MainComponent implements OnInit {
    constructor(private elementRef: ElementRef, private _cognitiveApiService: CognitiveApiService) {
        
    }
    localMediaStream = null;
    recorder;
    responseURL;
    analysisResult;
    videoRecordingStarted:boolean=false;
    videoRecorded:boolean=false;
    analysisInProgress:boolean=false;
    analysisCompleted:boolean=false;
    faceAnalysisInProgress:boolean=false;
    faceAnalysisCompleted:boolean=false;
    analysisStatus:Array<string>;
    faceAnalysisStatus:Array<string>;
    chatMessages:Array<Object>;
    age;
    gender;
    image;
    minimisedFooter: boolean=true;
    minimisedChat: boolean=false;
    muteChat: boolean=false;
    expressionMessages:Object;

    ngOnInit() {
        this.resetChat();
        this.insertChat("Hello there, Please record a video to begin.");
        this.expressionMessages = {
                "anger" : "Sorry if I offended you, let me connect you to my Boss, who I am sure can give you a better deal.",
                "sadness" : "Sorry to upset you, let me see what I can do to better the offer.",
                "happiness" : "I am glad that you liked our offer. Customer delight is my primary objective",
                "fear" : "Sorry I didn’t mean to scare you.",
                "surprise" : "I knew that the offer will surprise you. We really have quite a good deal for you.",
                "neutral" : "It was nice interacting with you. How else can I help you."
            };
    }

    startStreaming() {
        let video = this.elementRef.nativeElement.children.item(2).children.item(0);
        let component = this;
        if (navigator.getUserMedia) {
            navigator.getUserMedia({
                audio: true,
                video: true
            }, function(stream) {
                video.src = window.URL.createObjectURL(stream);
                component.localMediaStream = stream;
            }, function() {

            });
        } else {
            video.src = 'somevideo.webm'; // fallback.
        }
    }

    snapshot() {
        if(!this.recorder || this.recorder.getBlob() == null){
            alert("Please record a video for analysis");
            return;
        }
        let component = this;
        component.faceAnalysisCompleted = false;
        if (this.localMediaStream) {
            let video = this.elementRef.nativeElement.children.item(2).children.item(0).children.item(0);
            let canvas = this.elementRef.nativeElement.children.item(2).children.item(0).children.item(1);
            let ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            //image.src = canvas.toDataURL('image/jpeg');
            this.faceAnalysisStatus = ["Fetching face analysis results..."];
            this._cognitiveApiService.postImageForAnalysis(canvas.toDataURL('image/jpeg')).subscribe(
                result => {
                    if (result.completed) {
                    //    component.faceAnalysisInProgress = false;
                        component.faceAnalysisCompleted = true;
                        component.age = result.data.faceAttributes.age;
                        component.gender = result.data.faceAttributes.gender;
                        setTimeout(function() {
                            component.image = document.getElementsByClassName("profilePic")[0];
                            // let facePosition, top, left, width, height, styles;
                            // facePosition = result.data.faceRectangle;
                            // if(facePosition !== null && facePosition !== undefined){
                            //     styles = {
                            //         top : (facePosition.top * 100)/720 + "%",
                            //         left : (facePosition.left * 100)/1280 + "%",
                            //         width : (facePosition.width * 100)/1280 + "%",
                            //         height : (facePosition.height * 100)/720 + "%"
                            //     };
                            // }
                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                            ctx.drawImage(video, 0, 0);
                            component.image.src = canvas.toDataURL('image/jpeg');
                        });
                    }else{
                        component.faceAnalysisStatus.push('Face analysis is not complete...');
                    }
                }
            );
        }
    }

    startVideoCapture() {
        let mediaConstraints = {
            video: {
                mandatory: {
                    minWidth: 1280,
                    minHeight: 720
                }
            },
            audio: true
        };
        navigator.mediaDevices.getUserMedia(mediaConstraints)
            .then(this.startRecording.bind(this), function() {});
    }

    startRecording(stream) {
        this.videoRecordingStarted = true;
    	this.videoRecorded = false;
        let component = this;
        let video = this.elementRef.nativeElement.children.item(2).children.item(0).children.item(0);
        var options = {
            mimeType: 'video/mp4'
        };
        this.recorder = RecordRTC(stream, options);
        video.src = window.URL.createObjectURL(stream);
        this.localMediaStream = stream;
        this.recorder.startRecording();

        setTimeout(function() {
            component.stopRecording();
        }, 5000);
    }

    stopRecording() {
    	this.videoRecordingStarted = false;
    	this.videoRecorded = true;
        this.recorder.stopRecording(this.processVideo.bind(this));
        let stream = this.localMediaStream;
        stream.getAudioTracks().forEach(track => track.stop());
        stream.getVideoTracks().forEach(track => track.stop());
        this.insertChat("Please submit the video for analysis.");
    }

    analyzeVideo() {
        if(!this.recorder || this.recorder.getBlob() == null){
            this.insertChat("Please record a video and then click submit.");
            return;
        }
        this.insertChat("Please wait while the video analysis is in progress.");

    	this.analysisInProgress = true;
    	this.analysisCompleted = false;
    	this.analysisStatus = ["Uploading video for analysis..."];
        this._cognitiveApiService.postVideoForAnalysis(this.recorder.getBlob()).subscribe(
            result => {
            	this.analysisStatus.push('Video upload is completed...');
                this.getResult(result);
            }
        );
    }

    getResult(result) {
        let component = this;
        setTimeout(function() {
            component.analysisStatus.push('Checking for analysis results...');
            component._cognitiveApiService.getVideoAnalysis(result).subscribe(
                response => {
                    if (response.completed) {
                        component.insertChat("Video analysis is completed.");
                        component.analysisStatus.push('Video analysis is completed...');
                    	component.analysisInProgress = false;
    					component.analysisCompleted = true;
    					component.analysisResult = response.data;
                        component.processResult(response.data);
                        // component.faceAnalysisInProgress = true;
                        // component.faceAnalysisCompleted = false;
                        component.snapshot();
                    }else{
            			component.analysisStatus.push('Video analysis is still in progress...');
                        component.getResult(result);
                    }
                }
            );
        }, 10500);
    }

    processVideo(audioVideoWebMURL) {
        let video = this.elementRef.nativeElement.children.item(2).children.item(0).children.item(0);
        video.src = audioVideoWebMURL;
    }

    processResult(data) {
        let dominant = {
            "max" : 0,
            "expression" : "neutral"
        }
        if(data.anger > dominant.max) {
            dominant.max = data.anger;
            dominant.expression = "anger";
        } 
        if(data.sadness > dominant.max) {
            dominant.max = data.sadness;
            dominant.expression = "sadness";
        } 
        if(data.happiness > dominant.max) {
            dominant.max = data.happiness;
            dominant.expression = "happiness";
        }
        if(data.fear > dominant.max) {
            dominant.max = data.fear;
            dominant.expression = "fear";
        }
        if(data.surprise > dominant.max) {
            dominant.max = data.surprise;
            dominant.expression = "surprise";
        }
        this.insertChat(this.expressionMessages[dominant.expression]);
    }

    formatAMPM(date) {
        let hours = date.getHours();
        let minutes = date.getMinutes();
        let ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        minutes = minutes < 10 ? '0'+minutes : minutes;
        let strTime = hours + ':' + minutes + ' ' + ampm;
        return strTime;
    }

    resetChat(){
        this.chatMessages = [];
    }             

    insertChat(text){
        let chat = {
            "message" : text,
            "time" : this.formatAMPM(new Date())
        };
        this.chatMessages.push(chat);
        if(!this.muteChat) {
            let voiceMessage = new SpeechSynthesisUtterance(text);
            window.speechSynthesis.speak(voiceMessage);
        }
    }

    toggleMuteChat() {
        this.muteChat = !this.muteChat;
    }

    toggleMinimizeFooter() {
        let footer = this.elementRef.nativeElement.children.item(3);
        if(this.minimisedFooter){
            footer.style.height = "150px";
        } else {
            footer.style.height = "40px"
        }
        this.minimisedFooter = !this.minimisedFooter;
    }

    toggleMinimizeChat() {
        let footer = this.elementRef.nativeElement.children.item(2).children.item(1);
        if(this.minimisedChat){
            footer.style.height = "382px";
        } else {
            footer.style.height = "40px"
        }
        this.minimisedChat = !this.minimisedChat;
    }
}
	
