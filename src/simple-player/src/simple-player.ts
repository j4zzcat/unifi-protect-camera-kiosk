/*
 * This file is part of Viewport.
 * By Sharon Dagan <https://github.com/j4zzcat>, (C) Copyright 2024.
 *
 * Viewport is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * This software is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * This software. If not, see <https://www.gnu.org/licenses/>.
 */

import {Queue} from "typescript-collections";

export class SimplePlayer {
    private _videoElementId: string;
    private _url: string;
    private _mimeCodecs: string;
    private _ws: WebSocket;
    private _mediaSource: MediaSource;
    private _sourceBuffer: SourceBuffer;
    private _queue: Queue<Uint8Array>;

    private HOUSEKEEPING_INTERVAL_MESSAGES = 100;
    private CLEANUP_INTERVAL_SECONDS = 20;
    private KEEP_VIDEO_SECONDS = 10

    constructor(videoElementId, url) {
        this._videoElementId = videoElementId;
        this._url = url;

        this.log("Starting SimplePlayer");
        this.initialize();
    }

    private initialize() {
        const videoElement: HTMLVideoElement = document.getElementById(this._videoElementId) as HTMLVideoElement;
        if(videoElement == undefined) {
            throw Error(`Video element '${this._videoElementId}' not found`);
        }

        if (!("MediaSource" in window)) {
            throw new Error("MediaSource API is not available in your browser.");
        }
        this._mediaSource = new MediaSource();

        videoElement.src = URL.createObjectURL(this._mediaSource);
        this._mediaSource.addEventListener("sourceopen", this.onSourceOpen);
        this._mediaSource.addEventListener("sourceended", this.onSourceEnded);
        this._mediaSource.addEventListener("sourceclose", this.onSourceClose);
    }

    private firstMessage = true;
    private onSourceOpen = () => {
        this._ws = new WebSocket(this._url);
        this._ws.binaryType = "arraybuffer";

        this._ws.onopen = () => {
            this.log("WebSocket connection opened.");
        }

        let messageCount = 0;
        let cleanup = 0;
        let lastCleanup = Date.now();

        this._ws.onmessage = (event) => {
            messageCount++;

            // Do housekeeping cycle every HOUSE_KEEPING_INTERVAL_MESSAGES messages
            if(messageCount % this.HOUSEKEEPING_INTERVAL_MESSAGES == 0) {
                // Log stats
                this.log(`messageCount: ${messageCount}`);

                // Start a cleaning cycle every CLEANUP_INTERVAL_SECONDS
                if(cleanup == 0) {
                    if((Date.now() - lastCleanup) > this.CLEANUP_INTERVAL_SECONDS * 1000) {
                        cleanup = 1;
                    }
                }
            }

            if (messageCount == 1) {

                /*
                 * The first message from the server contains the codecs of this stream, which
                 * are usually avc1.4d4032 for video and mp4a.40.2 for audio. All other messages
                 * are fragments of the H.264 fMP4 stream of the camera. Essentially, this is
                 * the initialization section of the engine where the SourceBuffer and Queue
                 * are allocated.
                 */

                this._mimeCodecs = `video/mp4; codecs="${event.data}"`

                this.log(`mimeCodec: ${this._mimeCodecs}`);
                if (!MediaSource.isTypeSupported(this._mimeCodecs)) {
                    throw new Error(`Mime Codec not supported: ${this._mimeCodecs}`);
                }

                this._sourceBuffer = this._mediaSource.addSourceBuffer(this._mimeCodecs);
                this._queue = new Queue<Uint8Array>();

            } else if(messageCount == 2) {

                /*
                 * The second message from the server is the first message of the stream.
                 * It contains the Init segment of the stream and must be handled before
                 * all other messages.
                 */

                const data = new Uint8Array(event.data);
                this._sourceBuffer.appendBuffer(data);

            } else {

                /*
                 * All other messages are handled here. All of them are segments of the
                 * H.264 fMP4 stream. Ideally, when a message arives it can be appended
                 * to the SourceBuffer right away. However, there are times when the
                 * SourceBuffer is not yet ready, and so the message is enqueued.
                 * Whenever the SourceBuffer can be updated, all queued messages are
                 * appended to the SourceBuffer, effectively cleaning the queue and
                 * avoiding any lag accumulation.
                 */

                const data = new Uint8Array(event.data);
                this._queue.enqueue(data);

                if (this._sourceBuffer.updating == false) {

                    if (cleanup > 0) {

                        /*
                         * If this is a cleanup cycle, start it now. Cleanup can
                         * proceed only if the SourceBuffer is ready (i.e., not updating).
                         * The SourceBuffer is cleaned, leaving in it only the last
                         * KEEP_VIDEO_SECONDS seconds of video.
                         */

                        this.log(`Cleanup attempt: ${cleanup}`)

                        try {
                            let end = this._sourceBuffer.buffered.end(0);
                            this.log(`Cleaning up SourceBuffer, end: ${end}`);

                            this._sourceBuffer.remove(0, end - this.KEEP_VIDEO_SECONDS);
                            this.log("SourceBuffer cleaned");

                            cleanup = 0;
                            return;

                        } catch (e) {
                            this.log(`Failed to clean up SourceBuffer: ${e}`);
                            cleanup++;
                        }
                    }

                    // Dehydrate the queue and create one single buffer with
                    // all the received messages

                    const arrays: Uint8Array[] = [];

                    let totalLength = 0;
                    while (!this._queue.isEmpty()) {
                        const array = this._queue.dequeue();
                        arrays.push(array);
                        totalLength += array.length;
                    }

                    const allBuffers = new Uint8Array(totalLength);
                    let offset = 0;

                    for (const arr of arrays) {
                        allBuffers.set(arr, offset);
                        offset += arr.length;
                    }

                    // Append the single large buffer
                    this._sourceBuffer.appendBuffer(allBuffers);
                }
            }
        }
    }

    private onSourceEnded = () => {
        this.log("onSourceEnded");
    }

    private onSourceClose = () => {
        this.log("onSourceClose");
    }

    private log(message: string) {
        console.log(`[${Date.now()}] [${this._videoElementId}] ${message}`);
    }
}

