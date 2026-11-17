package com.hotel.repository;

import com.hotel.entity.Identifiable;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.function.Predicate;

/**
 * Storage abstraction used by all services.
 * <p>
 * The current implementations are in-memory ({@link com.hotel.repository.inmemory.InMemoryRepository}).
 * The method set intentionally mirrors Spring Data's {@code CrudRepository}, so a future
 * JPA implementation can satisfy the same interface without touching the service layer.
 */
public interface BaseRepository<T extends Identifiable> {

    List<T> findAll();

    List<T> findAll(Predicate<T> filter);

    Optional<T> findById(String id);

    boolean existsById(String id);

    /** Inserts (assigning an id when absent) or replaces the entity. */
    T save(T entity);

    List<T> saveAll(Collection<T> entities);

    boolean deleteById(String id);

    long count();

    void deleteAll();
}
