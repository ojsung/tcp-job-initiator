"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const net_1 = require("net");
const child_communications_js_1 = __importDefault(require("../config/child-communications.js"));
const config_1 = __importDefault(require("../config/config"));
const incrementRequests = child_communications_js_1.default.incrementRequests;
const decrementRequests = child_communications_js_1.default.decrementRequests;
class TCPJobInitiatorSocket {
    /**
     * A class to communicate across TCP sockets in a child process
     * @param socket The socket
     * @param process The child process
     */
    constructor(taskedIdentifier, process) {
        this.taskedIdentifier = taskedIdentifier;
        this.process = process;
        this.fullData = '';
        const host = taskedIdentifier.targetIp;
        const port = config_1.default.port;
        this.socket = net_1.createConnection({ host, port });
    }
    addSocketListeners() {
        // Get the callback functions for the socket from the TCPJobInitiatorSocket class
        this.socket.on('connect', () => {
            this.connect(this.taskedIdentifier);
        });
        this.socket.on('data', this.data);
        this.socket.on('end', this.end);
    }
    /**
     * The callback for the connect event
     * @param taskedIdentifier The identifier for the job to be run
     */
    connect(taskedIdentifier) {
        // As the master to increment the number of requests ongoing and total
        this.process.send(incrementRequests);
        // Send the task information across the socket to the destination
        this.socket.write(JSON.stringify(taskedIdentifier) + 'END');
    }
    /**
     * The data callback.  Data will be saved to this.fullData until the 'END' string is sent
     * @param data
     */
    data(data) {
        this.fullData += data;
        if (this.fullData.endsWith('END')) {
            // Should be a JSON...
            const dataAsJSON = JSON.parse(this.fullData.slice(0, -3));
            this.process.send({ data: dataAsJSON, task: this.taskedIdentifier });
            this.fullData = '';
        }
    }
    /**
     * The end callback.  It will send up an error to the master if an error occurred
     * Also notifies the parent to decrement the number of concurrent jobs
     * @param hadError
     */
    end(hadError) {
        if (hadError) {
            this.process.send('ERROR');
        }
        this.process.send(decrementRequests);
    }
}
exports.TCPJobInitiatorSocket = TCPJobInitiatorSocket;
//# sourceMappingURL=tcp-job-initiator-socket.js.map