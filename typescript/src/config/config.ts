const config = {
  // total number of forks to break out to
  // If set to a value <= 0, it will default to the number of cpus
  totalForks: -1,
  // The port on which everything should connect
  port: 4212,
  // Jobs to accept until a fork should be scheduled for death
  jobsUntilDeath: 50,
  // The amount of time to wait after a job is scheduled for death before force-killing it
  // Choose whether or not to force kill applications that never reach a point where they gracefully kill themselves
  // I strongly recommend that this be set to true to prevent memory leaks.
  doForceKills: true,
  // This will only trigger if the job never reaches a point where it can gracefully kill itself.
  timeoutToForceKill: 10800000, // 3 hours
  // Choose whether or not to force kill applications that fail to gracefully kill themselves.
  // Again, I strongly recommend that this be set to true
  doForceKillsWhenGracefulKillsFail: true,
  timeoutToForceKillWhenGracefulKillFailed: 10000 // ten seconds
}

export { config as default }
