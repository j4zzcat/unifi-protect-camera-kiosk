import time

from backend.cmdsrv import SimpleCommandServer
from context import GlobalFactory

if __name__ == '__main__':
    GlobalFactory.get_logger().set_level("DEBUG")
    scs = SimpleCommandServer()

    pg = GlobalFactory.new_process_group([
        SimpleCommandServer.Descriptor(id="1", args=["bash", "/tmp/script.sh"]),
        SimpleCommandServer.Descriptor(id="2", args=["bash", "/tmp/script.sh"]),
        SimpleCommandServer.Descriptor(id="3", args=["bash", "/tmp/script.sh"])],
        restart=True
    )


    scs.run_asynchronously(pg)


    while True:
        time.sleep(3)
        print("Main thread")