You already have two UML diagrams. The rest of UML 2 splits across the same three low-level designs, plus the high-level canvas for diagrams that describe the whole system.

| Diagram | Where it goes |
| --- | --- |
| Class | Database, next to the ERD. You have this. |
| Use case | App Server, next to APIs. You have this. |
| Object | Database, as a third view beside ERD and Class. Implemented — synced with ERD/Class. |
| Sequence | App Server. |
| Activity | App Server. |
| State machine | App Server. |
| Communication | App Server, only as another layout of a sequence. |
| Interaction overview | App Server, only after sequence and activity exist. |
| Package | App Server. |
| Component (inside one service) | App Server. |
| Composite structure | App Server. |
| Component (the whole system) | The high-level canvas, not an LLD. |
| Deployment | The high-level canvas, not an LLD. |
| Timing | Skip. The health panel already covers load over time. |
| Profile | Skip. It customizes UML itself, not your design. |

The Client LLD stays **Requests**. A request is one concrete call an actor makes. The use case that groups those calls already lives on the app server.

**Database** keeps structure that is the data. The ERD and the class diagram already share the same entities. An object diagram is a snapshot of those classes filled in with example rows, so it belongs in that same interior. Do not add behavior diagrams there.

**App Server** keeps behavior and the code of that service.

- A **sequence** diagram is one use case or one API played out over time: actor, this server, then the database, cache, or queue it can reach.
- An **activity** diagram is the workflow of that same use case: decisions, forks, and the API steps.
- A **state machine** is the lifecycle of one class the service changes, such as an order moving from placed to paid. Link the machine to that class; the transitions are what this server does.
- **Package**, **component**, and **composite structure** describe how this one service is divided inside (modules, parts, ports). That is separate from the class diagram on the database, which is the data model, not the service’s code.

**High-level canvas** is already the system-wide component and deployment view: clients, gateways, servers, caches, databases, queues, and the cables between them. A second copy of that inside one LLD would split the architecture across files.

If you add more, do sequence, then activity, then state machine, all on the app server. Object diagram on the database is done. Communication and interaction overview repeat sequence and activity. Timing and profile do not help this app.