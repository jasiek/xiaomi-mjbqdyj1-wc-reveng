# Objective

- We want to reverse engineer the bluetooth protocol for the MJBQDYJ1-WC Xiaomi Mijia Label Printer.
- This is a printer for the chinese market.
- I've installed the Mac OS X version of the Xiaomi Home app.
- We tried reverse engineering the mobile app (Android) but that proved too hard and we want to try the desktop app instead.
- We are looking to implement a client using bleak (python).
- Create a file, FINDINGS.md where you document your findings about how this works.

# Process

- You're already in a virtual environment activated via asdf (~/.asdf/shims/python), so install all deps confined to that.
- Read the source, deobfuscate if needed and then create a python client which can print an example.
- There's a printer at 03:13:00:01:4A:CC which you can use.

# Change tracking

- Once you get a piece of this working, commit your changes with a descriptive message.


