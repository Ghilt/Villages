# Retired event types

One file for each event type the code no longer writes, exactly as it was stored, named for its type. A stored event
of a retired type is read through its upcasters (`backend/infrastructure-occurrent/.../Upcasters.kt`) to the type the
code reads today, and `UpcastersSpec` holds every file here to read back so. A file is added the day its type is
retired and never changed after. None yet: every event is its first version. See decision record 0100.
