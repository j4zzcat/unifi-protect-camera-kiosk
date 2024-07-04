import * as shell from "shelljs";
import { ProtectApi, ProtectNvrBootstrap } from "unifi-protect";
import * as util from "node:util";

const USERID = 'viewport-1';
const PASSWORD = shell.exec('security find-generic-password -l dev-user -a unifi-protect -w', {silent: true}).split('\n')[0];

async function login(ufp: ProtectApi) {
    // Set a listener to wait for the bootstrap event to occur.
    ufp.once("bootstrap", (bootstrapJSON: ProtectNvrBootstrap) => {

        // Once we've bootstrapped the Protect controller, output the bootstrap JSON and we're done.
        process.stdout.write(util.inspect(bootstrapJSON, {
            colors: true,
            depth: null,
            sorted: true
        }) + "\n", () => process.exit(0));
    });

    // Login to the Protect controller.
    if (!(await ufp.login("192.168.4.10", USERID, PASSWORD))) {

        console.log("Invalid login credentials.");
        process.exit(0);
    }
    ;

    // Bootstrap the controller. It will emit a message once it's received the bootstrap JSON, or you can alternatively wait for the promise to resolve.
    if (!(await ufp.getBootstrap())) {

        console.log("Unable to bootstrap the Protect controller.");
        process.exit(0);
    }
}

// Create a new Protect API instance.
const ufp = new ProtectApi();
login(ufp);
