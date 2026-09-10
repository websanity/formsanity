<?php

declare(strict_types=1);

namespace WebSanity\FormSanity;

/** The outcome of validating a submission: the errors found, and the envelope and HTTP status that report them. */
final class Result
{
	/** @param list<array{field: ?string, code: string, message: string}> $errors */
	public function __construct(private array $errors)
	{
	}

	public function isValid(): bool
	{
		return $this->errors === [];
	}

	/** @return list<array{field: ?string, code: string, message: string}> */
	public function errors(): array
	{
		return $this->errors;
	}

	public function withError(?string $field, string $code, string $message): self
	{
		$result = clone $this;
		$result->errors[] = ['field' => $field, 'code' => $code, 'message' => $message];

		return $result;
	}

	public function envelope(?string $message = null, ?string $redirect = null): array
	{
		if ($this->isValid()) {
			return Envelope::accepted($message, $redirect);
		}

		return Envelope::invalid($this->errors);
	}

	public function httpStatus(): int
	{
		return $this->isValid() ? 200 : 422;
	}
}
