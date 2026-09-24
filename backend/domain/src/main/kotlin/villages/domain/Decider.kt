package villages.domain

/**
 * The rules of one kind of thing as two pure functions: decide turns a command and the current state into
 * events, evolve folds an event into the state. It depends on nothing, and everything that stores, routes or
 * shows the thing is downstream of it.
 *
 * One shape for every aggregate, so that the loop which reads a stream, folds it, decides and appends is
 * written once whatever the stream holds. [HouseDecider] is the first. See decision record 0055.
 */
interface Decider<C, S, E> {
    /** The state before anything has happened, which is where every stream's fold begins. */
    val initial: S

    fun decide(command: C, state: S): List<E>

    /** Total: a fold must never throw, so an event that cannot apply leaves the state as it was. */
    fun evolve(state: S, event: E): S

    /** The state after every event so far, from the beginning. */
    fun fold(events: List<E>): S = events.fold(initial, ::evolve)
}
