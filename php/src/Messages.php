<?php

declare(strict_types=1);

namespace WebSanity\FormSanity;

/** English text for every code in the vocabulary's Code Reference, one short sentence telling a person what to fix. */
final class Messages
{
	/** One entry per code the vocabulary registers. A code outside this catalog, including an `x-` code, has no entry here. */
	private const array CATALOG = [
		'required' => 'This field is required.',
		'type.alpha' => 'Enter letters only.',
		'type.alphanum' => 'Enter letters and numbers only.',
		'type.identifier' => 'Enter only letters, numbers, underscores, or hyphens.',
		'type.no-whitespace' => 'Remove the spaces from this value.',
		'type.email' => 'Enter a valid email address.',
		'type.cvv' => 'Enter a valid security code.',
		'type.ssn' => 'Enter a valid Social Security number.',
		'type.duration' => 'Enter a valid duration.',
		'type.us-dollar' => 'Enter a valid dollar amount.',
		'type.zip' => 'Enter a valid ZIP code.',
		'type.ipv4' => 'Enter a valid IPv4 address.',
		'type.ipv6' => 'Enter a valid IPv6 address.',
		'type.ip' => 'Enter a valid IP address.',
		'type.email-list' => 'Enter a list of valid email addresses.',
		'type.credit-card' => 'Enter a valid card number.',
		'type.us-phone' => 'Enter a valid US phone number.',
		'type.international-phone' => 'Enter a valid phone number.',
		'type.native' => 'Enter a value in the format this field expects.',
		'badinput' => 'This value is not in a format that can be read; fix it and try again.',
		'pattern' => 'Match the required format for this field.',
		'minlength' => 'Enter at least {n} characters.',
		'maxlength' => 'Enter no more than {n} characters.',
		'min' => 'Enter a value of at least {n}.',
		'max' => 'Enter a value of at most {n}.',
		'step' => 'Enter a value that matches the allowed increment for this field.',
		'constraint' => 'This value does not meet the form\'s rule for this field.',
		'min-time' => 'Enter a time no earlier than {n}.',
		'max-time' => 'Enter a time no later than {n}.',
		'min-digits' => 'Include at least {n} digits.',
		'min-uppercase' => 'Include at least {n} uppercase letters.',
		'min-lowercase' => 'Include at least {n} lowercase letters.',
		'group.required-any' => 'Choose at least one option in this group.',
		'group.required-together' => 'Fill in every field in this group, or leave them all empty.',
		'min-selected' => 'Choose at least {n} options.',
		'max-selected' => 'Choose no more than {n} options.',
		'file.max-size' => 'Choose a file smaller than {n}.',
		'file.accept' => 'Choose a file of an accepted type.',
		'unique' => 'This value is already taken.',
		'group.unique-values' => 'Each value in this group must be different.',
		'relevance' => 'This field is not currently part of the form.',
	];

	public static function for(string $code, array $params = []): string
	{
		if (!isset(self::CATALOG[$code])) {
			return '';
		}

		$message = self::CATALOG[$code];

		if (isset($params['n'])) {
			$message = str_replace('{n}', (string) $params['n'], $message);
		}

		return $message;
	}
}
