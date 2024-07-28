"""Viewport.

Usage:
  viewport streams [--verbose] [--layout=<layout>] <url>...
  viewport [--version] [--help]

Options:
  -v, --verbose      Be verbose.
  --layout=<layout>  The layout to use. Supported layouts are: grid and lms. [Default: grid:3x3]
  <url>              The URL of a live video stream, or controller. Supported protocols are: unifi:// and rtsp(s)://.

Example:
    To view all the cameras of an Unifi Protect Controller at 192.168.4.10:
    viewport streams --layout grid:3x3 unifi://username:password@192.168.4.10/_all

"""
from docopt import docopt
import logging

from app.context import Context
from app.error import ApplicationException
from version import Version


def main():
    arguments = docopt(
        __doc__,
        version="Viewport {version}".format(version=Version))

    logger = Context.get_logger().get_child("Cli")

    if arguments['--verbose']:
        Context.get_logger().set_level(logging.DEBUG)

    if arguments["streams"]:
        logger.debug("Processing 'streams' command")

        try:
            Context.get_executer().submit(
                Context.create_streams_command(
                    layout=arguments['--layout'],
                    urls=arguments['<url>']))

        except ApplicationException as e:
            print("Fatal error, stopping. Exit code: 127")
            exit(127)


if __name__ == '__main__':
    main()

