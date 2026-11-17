package com.sneha.hotel.service;

import com.sneha.hotel.entity.Customer;
import com.sneha.hotel.exception.BusinessException;
import com.sneha.hotel.exception.ResourceNotFoundException;
import com.sneha.hotel.repository.CustomerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CustomerService {

    private final CustomerRepository customerRepository;

    public CustomerService(CustomerRepository customerRepository) {
        this.customerRepository = customerRepository;
    }

    public List<Customer> getAll() {
        return customerRepository.findAll();
    }

    public Customer get(Long id) {
        return customerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", id));
    }

    @Transactional
    public Customer register(Customer customer) {
        if (customerRepository.existsByEmail(customer.getEmail())) {
            throw new BusinessException("A customer with email " + customer.getEmail() + " already exists");
        }
        customer.setId(null);
        return customerRepository.save(customer);
    }

    @Transactional
    public Customer update(Long id, Customer updated) {
        Customer c = get(id);
        c.setName(updated.getName());
        c.setPhone(updated.getPhone());
        return c;
    }
}
