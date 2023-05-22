const express = require('express')
const app = express()
const port = 3010
const cors = require("cors");
const docker = new require("dockerode")();
const amqp = require("amqplib");
const { v4: uuidv4 } = require('uuid');
const cluster = require("cluster");
const os = require("os");




/// ------------- MIDDLEWARES ------------------

app.use(express.json());
app.use(cors());




/// ------------------ RCP SERVER(WORKER) -------------------

async function startRcpServerAsWorker() {

  //connect to rabbitmq
  const { connection, channel } = await connectRabbitMQ();

  // declare rcpcodeexecutionqueue
  channel.prefetch(1);        // limit the no. of unack msg, fetch only one msg
  channel.assertQueue(codeExecutionQueue);

  // consumer for rcpCodeExecutionQueue
  channel.consume(codeExecutionQueue, async msg => {

    const { code, language } = JSON.parse(msg.content.toString());

    try {
        // process the rcp request / execute code inside container
        const executionResult = await executeUserCodeInContainer(code, language);

        // publish the result to the response queue
        channel.sendToQueue(msg.properties.replyTo, Buffer.from(JSON.stringify(executionResult)), {
            correlationId: msg.properties.correlationId
        });

        // acknowledge the message (dqueue)
        channel.ack(msg);
    }
    catch (err) {
        console.log("Error processing RCP request for execution: ", err);
        process.exit(1);    // terminate
    }

  });

}




/// --------------- RPC CLIENT ----------------

const codeExecutionQueue = "rpcCodeExecutionQueue";

// Connect to rabbit mq
async function connectRabbitMQ() {

  const connection = await amqp.connect("amqp://localhost:5672");
  const channel = await connection.createChannel();
  return{ connection, channel};

}

// Publish message to queue
async function publishMessageToCodeExecutionQueue(connection, channel, code, language, res) {

  // set up responsequeue (temp)
  const responseQueue = await channel.assertQueue("", { exclusive: true });
  const responseQueueName = responseQueue.queue;

  const correlationId = uuidv4();

  // consumer for the response queue
  channel.consume(responseQueueName, msg => {
      if (msg.properties.correlationId == correlationId) {
          const result = JSON.parse(msg.content.toString());
          res.status(200).json(result);
          console.log(result.result);
          channel.close();
          connection.close();
      }
  }, { noAck: true });

  // publish msg(code) to rcpcodeExecutionQueue / send rcp request
  channel.sendToQueue(codeExecutionQueue, Buffer.from(JSON.stringify({ code, language })), {
      correlationId,
      replyTo: responseQueueName
  });

}




/// ----------------- DOCKER LOGIC ----------------------

// Create container according to user selected language
async function createDockerContainer(language, code) {

  const containerConfig = {
    Image: getDockerImage(language), //node
    Cmd: getExecutionCommand(language, code), // ["node", "-e", code]
    Tty: true,
    // HostConfig: {
    //   StopTimeout: 2, // Stop the container after 2 seconds
    // },
  }
  // same as docker create --image imageName --tty --command cmdToRun
  const container = await docker.createContainer(containerConfig) 
  
  return container;

}

// helper fun to get image according to user Selected language
function getDockerImage(language) {

  let image;

  switch (language) {
    case 'cpp':
      image = "gcc"
      break;
    case "js":
      image = "node";
      break;
    case "c": 
      image = "gcc";
      break;
    default:
      throw new Error(`unsupprted language: ${language}`);
  }

  return image;

}

// helper fun to get Execution command acc... to user selected language
function getExecutionCommand(language, code){

  let cmd;

  switch (language) {
    case 'cpp':
      cmd = ['bash', '-c', `echo "${code}" > myapp.cpp && g++ -o myapp myapp.cpp && ./myapp`];
      break;
    case "js":
      cmd = ["node", "-e", code];
      break;
    case "c":
      console.log(code);
      cmd = ['bash', '-c', `echo "${code}" > myapp.c && gcc -o myapp myapp.c && ./myapp`];
      break;
    default:
      throw new Error(`unsupprted language: ${language}`);
  }

  return cmd;

}




/// ------------------- CODE EXECUTION LOGIC -----------------

async function executeUserCodeInContainer(code, language) {
  return new Promise(async (resolve, reject) => {
    console.log("executing code");
    const container = await createDockerContainer(language, code);
    await container.start();

    // send a TLE after 2sec
    const tle = setTimeout(async () => {
      console.log("sending a tle")
      resolve({result: "Time Limit Exceed!! 😔 \n \n - Optimize your code \n - Avoid infinite loops", sucess: false});
      await container.stop();
    }, 2000);

    const containerExitStatus = await container.wait(); // wait for container to exit

    // get logs
    const logs = await container.logs({ stdout: true, stderr: true });

    // return output/error
    if (containerExitStatus.StatusCode === 0) {
      resolve({ result: logs.toString(), sucess: true });
      clearTimeout(tle);
      await container.remove();
    } else {
      resolve({ result: logs.toString(), sucess: false });
      clearTimeout(tle);
      await container.remove();
    }
  });
}




///----------------- ROUTES -----------------------

app.post("/submissions", async (req, res) => {
  let body = req.body;
  let userSubmittedCode = body.submission.code;
  let codeLanguage = body.submission.language;

  try {

    const { connection, channel } = await connectRabbitMQ();
    await publishMessageToCodeExecutionQueue(connection, channel, userSubmittedCode, codeLanguage, res);
    
  }
  catch (er) {
      console.log("Error Publishing message to RcpCodeExecution queue", er);
      res.status(500).json({ err: "Somethig Went Wrong" });
  }

});




/// ------------- SCALE USING CLUSTER ----------------

// get cpu threads
let cpuThreads = os.cpus().length;  // 12 (my i5 12400)
if ( cpuThreads >= 4 ) cpuNum = 4; // limit worker to 4

if (cluster.isMaster) {
  for (let i = 0; i < cpuNum; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} exited`);
    cluster.fork();
  });
}
else {
  startRcpServerAsWorker();

  const server = app.listen(port, () => {
    console.log(`server ${process.pid} is listening on port ${port}`)
  })

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.log(`Port ${port} is already in use`);
    } else {
      console.error('An error occurred:', error);
    }
  });
}