# System Design Lab

System Design Lab is a desktop app for sketching a backend. You place clients, servers, caches, databases, and queues on a canvas, connect them with cables, and open a component to design what is inside it.

It is a design tool, not a running system. Nothing here talks to real servers.

## What you can do

- Draw a high-level architecture.
- Open a component and design what is inside it: database tables, API endpoints, or the requests a client makes.
- Save the design and open it later.

## The workspace

The window has two areas.

- **Canvas** in the center. This is your architecture.
- **Device tray** along the bottom. Pick what to add.

A status bar at the bottom tells you which tool is active and how many devices and cables are on the canvas.

## Building a design

### Add a component

The tray is organized into tabs:

| Tab | What you can add |
| --- | --- |
| Clients | Client |
| Edge | Load Balancer, API Gateway, CDN |
| Compute | App Server |
| Data | Cache, Database |
| Async | Message Queue |
| Connections | Copper cable |

Click a tile, then click the canvas to place it. You can also drag a tile onto the canvas. Press Esc to cancel placement.

### Connect components

Cables show how components are connected.

- Hover a device and drag from a port to another device, or
- Choose **Copper cable**, click the source, then click the destination.

Double-click a cable to name it. The label is for people reading the diagram.

### Move, select, and edit

| Tool | What it does |
| --- | --- |
| Select | Move devices, select them, and drag ports to connect |
| Hand | Drag the canvas to pan |
| Delete | Click a device or cable to remove it |

Right-click for **Properties**, **Duplicate**, **Delete**, **Group selected**, and **Ungroup**.

Select several items and group them into a card with a title and notes. Groups are for organizing the diagram. Open **Properties** on a device to change its label.

### Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| Delete or Backspace | Delete the selection |
| Ctrl+Z | Undo |
| Ctrl+Y or Ctrl+Shift+Z | Redo |
| Ctrl+A | Select all |
| Ctrl+D | Duplicate |
| Ctrl+G | Group the selection |
| Ctrl+Shift+G | Ungroup |
| Esc | Cancel the current action, or step back out of a component |

## Looking inside a component

Double-click a **Database**, **App Server**, or **Client** while Select is active. The canvas zooms into that component. A breadcrumb at the top shows where you are. **Back** or Esc returns you to the architecture. The project name in the breadcrumb jumps straight back to the top.

What you draw inside is saved with the component.

### Database

Switch between three views in the breadcrumb. All three share the same entities and relationships — add or remove an entity in one, and it appears in the others too:

- **ERD** — place entities (tables), give them attributes, mark primary and foreign keys, and connect them with relationships.
- **UML** — place classes with attributes and methods, and connect them with association, inheritance, aggregation, or composition.
- **Object diagram** — pick an instance name for each class (for example `booking1 : Booking`) and fill in example values for its attributes. New entities are still added from ERD or UML; this view only fills in example data on entities that already exist.

### App Server

Switch between two views in the breadcrumb:

- **API** — place an endpoint and set its type: REST, GraphQL, gRPC, SOAP, JSON-RPC, WebSocket, SSE, or Webhook. Each type has its own fields (method and path, operation name, service and method, events, and so on). Where the type has parameters, open the parameter editor to add them. You can also attach table entities copied from a database in the same design, so the API shows the columns it reads or writes.
- **Use case** — place actors and use cases, and connect them with association, include, or extend. Open a use case to choose which APIs on this server realize it. Those API names show under the use case.

### Client

The tray offers **Request**. A request points at an API on an app server this client can reach through the cables. Fill in the parameter values for that call. If the API is missing, unreachable, or a required value is empty, the request is marked so you can fix it.

## Saving your work

Use the **File** menu:

- **New** starts a blank design. If you have unsaved changes, the app asks before discarding them.
- **Open** loads a saved project.
- **Save** writes the current project.
- **Save As** writes a copy to a new location.

A dot in the window title means the design has unsaved changes.

A project is stored as a small set of files: a manifest, the high-level diagram, and one file per component for its detailed settings and interior diagrams.
