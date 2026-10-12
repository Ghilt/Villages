package villages.occurrent

import com.mongodb.MongoCommandException
import com.mongodb.ServerAddress
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import org.bson.BsonDocument
import org.bson.BsonInt32
import org.bson.BsonString
import villages.application.Fault
import villages.application.FaultBoard
import java.util.concurrent.CopyOnWriteArrayList

/** What a carrier says when it fails: an outage once, until an event is carried, and a lost place every time. */
class CarrierFaultsSpec : StringSpec({
    fun heardOn(board: FaultBoard) = CopyOnWriteArrayList<Fault>().also { heard -> board.watch { heard += it } }

    "an event tried again and again is said once, and again only after one has been carried" {
        val faults = FaultBoard()
        val heard = heardOn(faults)
        val said = CarrierFaults("bridge", faults)

        repeat(3) { said.failed(IllegalStateException("the broker is not answering")) }
        heard.size shouldBe 1
        said.carried()
        said.failed(IllegalStateException("the broker is not answering, again"))

        heard.map { it.about } shouldBe List(2) { "an event it hands on again until it is carried" }
    }

    "a place too old for MongoDB to resume from is said every time, because what was written meanwhile is lost" {
        val faults = FaultBoard()
        val heard = heardOn(faults)
        val said = CarrierFaults("bridge", faults)
        val lost = MongoCommandException(
            BsonDocument("code", BsonInt32(286)).append("errmsg", BsonString("the resume point is not in the oplog")),
            ServerAddress(),
        )

        said.failed(lost)
        said.failed(lost)

        heard.map { it.about } shouldBe List(2) { "a place too old for MongoDB to resume from, so it carries from now" }
    }
})
