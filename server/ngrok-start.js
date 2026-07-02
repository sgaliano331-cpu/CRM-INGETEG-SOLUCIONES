const { spawn } = require('child_process');
const ngrok = spawn('ngrok', ['http', '3001'], { stdio: 'inherit', shell: true });
ngrok.on('close', (code) => { process.exit(code); });
