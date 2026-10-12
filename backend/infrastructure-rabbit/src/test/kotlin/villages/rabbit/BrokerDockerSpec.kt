package villages.rabbit

import com.rabbitmq.client.AMQP
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.core.test.Enabled
import io.kotest.core.test.TestCase
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import org.testcontainers.DockerClientFactory
import org.testcontainers.rabbitmq.RabbitMQContainer

/**
 * A tree's broker against a real RabbitMQ: one of the spec's own in a container, the image the stack runs, with the
 * user the stack makes, thrown away after it, as `TESTING.md` asks (decision record 0092). The broker is prepared
 * by the server at every start, so preparing is idempotent and keeps each tree to its own virtual host (0094).
 *
 * The cases that need Docker say so in their names, and are skipped with the reason when Docker is not running.
 */
class BrokerDockerSpec : StringSpec({
    val docker = DockerClientFactory.instance().isDockerAvailable
    val needsDocker: (TestCase) -> Enabled = {
        if (docker) Enabled.enabled else Enabled.disabled("needs Docker, and Docker is not running")
    }

    val rabbit by lazy {
        RabbitMQContainer("rabbitmq:4.3-management").withAdminUser("villages").withAdminPassword("villages")
            .also { it.start() }
    }
    afterSpec { if (docker) rabbit.stop() }

    fun broker(virtualHost: String) =
        Broker("amqp://villages:villages@${rabbit.host}:${rabbit.amqpPort}", rabbit.httpUrl, virtualHost)

    "a tree's virtual host is made, the user given it, and the exchange declared in it, at every start (needs Docker)"
        .config(enabledOrReasonIf = needsDocker) {
            val broker = broker("villages-a-tree")
            broker.prepare()
            broker.prepare()

            broker.connect("the spec").use { connection ->
                connection.createChannel().use { channel ->
                    channel.exchangeDeclarePassive(Broker.EXCHANGE).shouldNotBeNull()
                }
            }
        }

    "what is published in one tree's virtual host is never seen in another's (needs Docker)"
        .config(enabledOrReasonIf = needsDocker) {
            val ours = broker("villages-ours").apply { prepare() }
            val theirs = broker("villages-theirs").apply { prepare() }

            ours.connect("the spec, ours").use { connection ->
                connection.createChannel().use { channel ->
                    val everything = channel.queueDeclare().queue
                    channel.queueBind(everything, Broker.EXCHANGE, "#")

                    theirs.connect("the spec, theirs").use { other ->
                        other.createChannel().use {
                            it.confirmSelect()
                            it.basicPublish(Broker.EXCHANGE, "house.founded.v1.none", AMQP.BasicProperties(), byteArrayOf(1))
                            it.waitForConfirmsOrDie(5_000)
                        }
                    }
                    channel.basicPublish(Broker.EXCHANGE, "house.founded.v1.none", AMQP.BasicProperties(), byteArrayOf(2))
                    Thread.sleep(200)

                    channel.basicGet(everything, true)!!.body.toList() shouldBe listOf<Byte>(2)
                    channel.basicGet(everything, true).shouldBeNull()
                }
            }
        }

    "a broker that does not answer stops a start and says so in words" {
        val nobody = Broker("amqp://villages:villages@localhost:1", "http://localhost:1", "villages-nowhere")

        shouldThrow<IllegalStateException> { nobody.prepare() }.message.shouldNotBeNull() shouldContain
            "RabbitMQ did not answer at its management page at http://localhost:1"
        shouldThrow<IllegalStateException> { nobody.connect("the spec") }.message.shouldNotBeNull() shouldContain
            "RabbitMQ did not answer at amqp://localhost:1"
    }
})
