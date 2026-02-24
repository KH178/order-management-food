import pino from "pino";
const logger = pino({ level: "info" });

logger.info("Starting all background workers in a single process...");

import "./outbox-processor";
import "./saga-consumer";
import "./projection-consumer";
