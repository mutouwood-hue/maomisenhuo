package com.catforest.app

/** Standalone JVM contract, no Android/JSON dependency. Compile with the queue and gate sources. */
fun main() {
    fun event(id: String, pet: String = "cat-a", revision: Long = 4) =
        DeferredVisualQueue.Event(id, pet, revision, "committed-presentation-$id")

    val queue = DeferredVisualQueue(12)
    check(queue.enqueue(event("care")))
    check(queue.enqueue(event("grow"))) // same revision, different real event
    check(!queue.enqueue(event("care")))
    check(queue.size == 2)
    check(queue.drain("cat-a", 20).map { it.eventId } == listOf("care", "grow"))
    check(queue.size == 0)

    repeat(13) { queue.enqueue(event("event-$it")) }
    check(queue.size == 12 && queue.droppedVisuals == 1L)
    check(queue.drain("cat-a", 4).first().eventId == "event-1")
    queue.enqueue(event("other", "cat-b"))
    queue.enqueue(event("future", revision = 30))
    check(queue.drain("cat-a", 20).isEmpty())
    queue.enqueue(event("pause")); queue.clear()
    check(queue.drain("cat-a", 20).isEmpty())

    val gate = VisualFeedbackGate()
    check(!gate.accept("background"))
    gate.resume()
    check(gate.accept("care") && gate.accept("grow"))
    check(!gate.accept("care"))
    gate.pause(); check(!gate.accept("new"))
    gate.resume(); check(gate.accept("new"))
    println("Deferred visual queue and exact-event gate contracts passed")
}
