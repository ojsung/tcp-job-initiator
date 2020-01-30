"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
/**
 * Job status notifier
 * @augments EventEmitter
 * This event emitter will emit the following events:
 * * (event: 'task-complete', taskdata: ITaskData) - Emit when a child process completes a task, and sends the data back up to the parent
 * * (event: 'worker-exit', taskExit: ITaskExit) - Emit when a child process exits properly
 * * (event: 'worker-error', taskError: ITaskError) - Emit when a child process errors out
 * * (event: 'unfinished-job', taskedChannelIdentifier: ITaskedChannelIdentifier) - Emit when a task cannot currently be completed by the child or the application and needs to be reassigned
 */
class JobStatusNotifier extends events_1.EventEmitter {
}
exports.JobStatusNotifier = JobStatusNotifier;
//# sourceMappingURL=job-status-notifier.abstract.js.map