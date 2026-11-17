package com.hotel.repository.inmemory;

import com.hotel.entity.Identifiable;
import com.hotel.repository.BaseRepository;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Predicate;
import java.util.function.UnaryOperator;

/**
 * Thread-safe in-memory repository backed by a {@link ConcurrentHashMap}.
 * <p>
 * IDs are generated as {@code PREFIX-000123}. Entities are defensively copied on the way
 * in and out, so callers can never mutate stored state without calling {@link #save}.
 * Multi-step business operations (e.g. "check overlap, then save") must still be
 * synchronised by the service layer; this class only guarantees per-call atomicity.
 */
public abstract class InMemoryRepository<T extends Identifiable> implements BaseRepository<T> {

    private final ConcurrentMap<String, T> store = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong();
    private final String idPrefix;
    private final UnaryOperator<T> copier;

    /**
     * @param idPrefix prefix for generated ids, e.g. "BK"
     * @param copier   creates a detached copy of an entity (typically Lombok {@code toBuilder().build()})
     */
    protected InMemoryRepository(String idPrefix, UnaryOperator<T> copier) {
        this.idPrefix = idPrefix;
        this.copier = copier;
    }

    @Override
    public List<T> findAll() {
        return findAll(e -> true);
    }

    @Override
    public List<T> findAll(Predicate<T> filter) {
        List<T> result = new ArrayList<>();
        for (T entity : store.values()) {
            if (filter.test(entity)) {
                result.add(copier.apply(entity));
            }
        }
        result.sort(Comparator.comparing(Identifiable::getId));
        return result;
    }

    @Override
    public Optional<T> findById(String id) {
        return Optional.ofNullable(id).map(store::get).map(copier);
    }

    @Override
    public boolean existsById(String id) {
        return id != null && store.containsKey(id);
    }

    @Override
    public T save(T entity) {
        T copy = copier.apply(entity);
        if (copy.getId() == null || copy.getId().isBlank()) {
            copy.setId(nextId());
        } else {
            advanceSequencePast(copy.getId());
        }
        store.put(copy.getId(), copy);
        return copier.apply(copy);
    }

    @Override
    public List<T> saveAll(Collection<T> entities) {
        return entities.stream().map(this::save).toList();
    }

    @Override
    public boolean deleteById(String id) {
        return id != null && store.remove(id) != null;
    }

    @Override
    public long count() {
        return store.size();
    }

    @Override
    public void deleteAll() {
        store.clear();
        sequence.set(0);
    }

    protected String nextId() {
        String id;
        do {
            id = "%s-%04d".formatted(idPrefix, sequence.incrementAndGet());
        } while (store.containsKey(id));
        return id;
    }

    /** Keeps generated ids from colliding with seeded ids such as "BK-0040". */
    private void advanceSequencePast(String id) {
        String expectedStart = idPrefix + "-";
        if (!id.startsWith(expectedStart)) {
            return;
        }
        try {
            long numeric = Long.parseLong(id.substring(expectedStart.length()));
            sequence.accumulateAndGet(numeric, Math::max);
        } catch (NumberFormatException ignored) {
            // Non-numeric suffix (e.g. "RM-101A"): nothing to advance.
        }
    }
}
