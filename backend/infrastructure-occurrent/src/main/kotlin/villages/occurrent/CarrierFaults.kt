package villages.occurrent

import com.mongodb.MongoCommandException
import villages.application.Fault
import villages.application.Faults
import java.util.concurrent.atomic.AtomicBoolean

/**
 * What a carrier says when it fails (see `MongoWorld.carry`). An event it cannot carry is tried again and again,
 * so that is said once, and not again until one has been carried: an outage is one line, not one every five seconds.
 * A place too old for MongoDB to resume from is said every time, because what was written meanwhile is not carried.
 */
internal class CarrierFaults(private val name: String, private val faults: Faults) {
    private val failing = AtomicBoolean(false)

    fun failed(thrown: Throwable) {
        if (thrown is MongoCommandException && thrown.errorCode == HISTORY_LOST) {
            faults.report(Fault(name, "a place too old for MongoDB to resume from, so it carries from now", thrown))
        } else if (failing.compareAndSet(false, true)) {
            faults.report(Fault(name, "an event it hands on again until it is carried", thrown))
        }
    }

    fun carried() = failing.set(false)

    private companion object {
        /**
         * MongoDB's ChangeStreamHistoryLost: a place its oplog no longer reaches back to, once the oplog has been cut
         * short. Occurrent then starts the subscription again from now. An oplog never cut short, as on a replica set
         * started for a test, reaches back to any time at all, so only this is tested and not MongoDB's answer.
         */
        const val HISTORY_LOST = 286
    }
}
